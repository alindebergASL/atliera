import { assertSafeArtifactKey, type ArtifactPutTextOptions, type ArtifactStore, type TextArtifact } from "./store.ts";

export interface S3PutObjectInput {
  bucket: string;
  key: string;
  body: string;
  contentType: string;
  metadata: Record<string, string>;
}

export interface S3GetObjectInput {
  bucket: string;
  key: string;
}

export interface S3GetObjectOutput {
  body: string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface S3ArtifactStoreClient {
  putObject(input: S3PutObjectInput): Promise<void>;
  getObject(input: S3GetObjectInput): Promise<S3GetObjectOutput | undefined>;
}

export interface S3ArtifactStoreEvent {
  operation: "putText" | "getText";
  status: "start" | "success" | "failure";
  key: string;
  durationMs: number;
  failureCategory?: "dependency_unavailable";
}

export type S3ArtifactStoreObserver = (event: S3ArtifactStoreEvent) => void;

export interface S3ArtifactStoreOptions {
  bucket: string;
  prefix?: string;
  maxPayloadBytes?: number;
  client: S3ArtifactStoreClient;
  observe?: S3ArtifactStoreObserver;
}

const SAFE_BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const textEncoder = new TextEncoder();

function assertSafeBucket(bucket: string): void {
  const looksLikeIpv4Address = /^\d+\.\d+\.\d+\.\d+$/.test(bucket);
  if (bucket.trim() !== bucket || !SAFE_BUCKET_NAME.test(bucket) || bucket.includes("..") || looksLikeIpv4Address) {
    throw new Error("S3ArtifactStore bucket must be a non-empty logical bucket name");
  }
}

function normalizePrefix(prefix: string | undefined): string {
  if (prefix === undefined || prefix === "") {
    return "";
  }

  if (prefix.trim() !== prefix || prefix.startsWith("/") || prefix.includes("://") || prefix.includes("\\")) {
    throw new Error("S3ArtifactStore prefix must be a relative prefix made of safe artifact-key segments");
  }

  const withoutTrailingSlash = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  try {
    assertSafeArtifactKey(withoutTrailingSlash);
  } catch {
    throw new Error("S3ArtifactStore prefix must be a relative prefix made of safe artifact-key segments");
  }
  return `${withoutTrailingSlash}/`;
}

function assertMaxPayloadBytes(maxPayloadBytes: number | undefined): void {
  if (maxPayloadBytes === undefined) {
    return;
  }

  if (!Number.isSafeInteger(maxPayloadBytes) || maxPayloadBytes < 1) {
    throw new Error("S3ArtifactStore maxPayloadBytes must be a positive safe integer when provided");
  }
}

function payloadBytes(content: string): number {
  return textEncoder.encode(content).byteLength;
}

function wrapBackendError(operation: "putText" | "getText"): Error {
  return new Error(
    `S3ArtifactStore ${operation} failed: dependency_unavailable; backend error details were sanitized`,
  );
}

export class S3ArtifactStore implements ArtifactStore {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly maxPayloadBytes: number | undefined;
  private readonly client: S3ArtifactStoreClient;
  private readonly observe: S3ArtifactStoreObserver | undefined;

  constructor(options: S3ArtifactStoreOptions) {
    assertSafeBucket(options.bucket);
    assertMaxPayloadBytes(options.maxPayloadBytes);

    this.bucket = options.bucket;
    this.prefix = normalizePrefix(options.prefix);
    this.maxPayloadBytes = options.maxPayloadBytes;
    this.client = options.client;
    this.observe = options.observe;
  }

  async putText(key: string, content: string, options: ArtifactPutTextOptions): Promise<void> {
    assertSafeArtifactKey(key);

    if (this.maxPayloadBytes !== undefined && payloadBytes(content) > this.maxPayloadBytes) {
      throw new Error("artifact payload exceeds configured maxPayloadBytes");
    }

    const startedAt = Date.now();
    this.emit({ operation: "putText", status: "start", key, durationMs: 0 });

    try {
      await this.client.putObject({
        bucket: this.bucket,
        key: this.toObjectKey(key),
        body: content,
        contentType: options.contentType,
        metadata: { ...(options.metadata ?? {}) },
      });
      this.emit({ operation: "putText", status: "success", key, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.emit({
        operation: "putText",
        status: "failure",
        key,
        durationMs: Date.now() - startedAt,
        failureCategory: "dependency_unavailable",
      });
      throw wrapBackendError("putText");
    }
  }

  async getText(key: string): Promise<TextArtifact | undefined> {
    assertSafeArtifactKey(key);

    let object: S3GetObjectOutput | undefined;
    const startedAt = Date.now();
    this.emit({ operation: "getText", status: "start", key, durationMs: 0 });

    try {
      object = await this.client.getObject({ bucket: this.bucket, key: this.toObjectKey(key) });
      this.emit({ operation: "getText", status: "success", key, durationMs: Date.now() - startedAt });
    } catch (error) {
      this.emit({
        operation: "getText",
        status: "failure",
        key,
        durationMs: Date.now() - startedAt,
        failureCategory: "dependency_unavailable",
      });
      throw wrapBackendError("getText");
    }

    if (object === undefined) {
      return undefined;
    }

    return {
      key,
      content: object.body,
      contentType: object.contentType,
      metadata: { ...(object.metadata ?? {}) },
    };
  }

  private toObjectKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private emit(event: S3ArtifactStoreEvent): void {
    try {
      this.observe?.({ ...event });
    } catch {
      // Observability is best-effort and must not change storage outcomes.
    }
  }
}
