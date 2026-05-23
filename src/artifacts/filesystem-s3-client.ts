import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, realpath, rename, rm, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import { assertSafeArtifactKey } from "./store.ts";
import type { S3ArtifactStoreClient, S3GetObjectInput, S3GetObjectOutput, S3PutObjectInput } from "./s3-store.ts";

export interface FilesystemS3CompatibilityClientOptions {
  readonly rootDir: string;
}

interface StoredObject {
  readonly body: string;
  readonly contentType: string;
  readonly metadata: Record<string, string>;
}

const SAFE_BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export class FilesystemS3CompatibilityClient implements S3ArtifactStoreClient {
  private readonly rootDir: string;

  constructor(options: FilesystemS3CompatibilityClientOptions) {
    if (typeof options.rootDir !== "string" || options.rootDir.trim() !== options.rootDir || !isAbsolute(options.rootDir)) {
      throw new Error("FilesystemS3CompatibilityClient rootDir must be an absolute directory path");
    }
    this.rootDir = options.rootDir;
  }

  async putObject(input: S3PutObjectInput): Promise<void> {
    assertSafeBucket(input.bucket);
    assertSafeObjectKey(input.key);
    assertSafePutPayload(input);

    const root = await this.ensurePrivateRoot();
    const objectsDir = join(root, "buckets", input.bucket, "objects");
    await mkdirInsideRoot(root, objectsDir);
    const objectPath = objectFilePath(objectsDir, input.key);
    await assertReplaceTargetIsSafe(root, objectPath);

    const nonce = `${process.pid}-${Date.now()}-${randomNonce()}`;
    const tempPath = join(objectsDir, `.object.${nonce}.tmp`);
    const storedObject: StoredObject = {
      body: input.body,
      contentType: input.contentType,
      metadata: { ...input.metadata },
    };

    try {
      await writeNewFileNoFollow(tempPath, `${JSON.stringify(storedObject, null, 2)}\n`);
      await rename(tempPath, objectPath);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  async getObject(input: S3GetObjectInput): Promise<S3GetObjectOutput | undefined> {
    assertSafeBucket(input.bucket);
    assertSafeObjectKey(input.key);

    const root = await this.ensurePrivateRoot();
    const objectsDir = join(root, "buckets", input.bucket, "objects");
    const directoryState = await safeDirectoryState(root, objectsDir);
    if (directoryState === "missing") {
      return undefined;
    }

    const objectPath = objectFilePath(objectsDir, input.key);
    const fileState = await safeFileState(root, objectPath);
    if (fileState === "missing") {
      return undefined;
    }

    const storedObject = parseStoredObject(await readFileNoFollow(objectPath));
    return {
      body: storedObject.body,
      contentType: storedObject.contentType,
      metadata: { ...storedObject.metadata },
    };
  }

  private async ensurePrivateRoot(): Promise<string> {
    await mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    await chmod(this.rootDir, 0o700);
    const root = await realpath(this.rootDir);
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) {
      throw new Error("FilesystemS3CompatibilityClient rootDir must resolve to a directory");
    }
    return root;
  }
}

function assertSafeBucket(bucket: string): void {
  const looksLikeIpv4Address = /^\d+\.\d+\.\d+\.\d+$/.test(bucket);
  if (typeof bucket !== "string" || bucket.trim() !== bucket || !SAFE_BUCKET_NAME.test(bucket) || bucket.includes("..") || looksLikeIpv4Address) {
    throw new Error("bucket must be a safe logical bucket name");
  }
}

function assertSafeObjectKey(key: string): void {
  try {
    assertSafeArtifactKey(key);
  } catch {
    throw new Error("object key must be a safe relative key");
  }
}

function assertSafePutPayload(input: S3PutObjectInput): void {
  if (typeof input.body !== "string") {
    throw new Error("object body must be a string");
  }
  if (typeof input.contentType !== "string" || input.contentType.trim() !== input.contentType || input.contentType.length === 0) {
    throw new Error("object contentType must be a non-empty string");
  }
  if (typeof input.metadata !== "object" || input.metadata === null || Array.isArray(input.metadata)) {
    throw new Error("object metadata must be a string record");
  }
  for (const [key, value] of Object.entries(input.metadata)) {
    if (typeof key !== "string" || key.length === 0 || typeof value !== "string") {
      throw new Error("object metadata must be a string record");
    }
  }
}

async function mkdirInsideRoot(root: string, targetDir: string): Promise<void> {
  assertInsideRoot(root, targetDir);

  const relativePath = relative(root, targetDir);
  let current = root;
  for (const segment of relativePath.split("/").filter(Boolean)) {
    current = join(current, segment);
    let existing;
    try {
      existing = await lstat(current);
    } catch (error) {
      if (isNotFoundError(error)) {
        await mkdir(current, { mode: 0o700 });
        continue;
      }
      throw error;
    }

    if (existing.isSymbolicLink()) {
      throw new Error("resolved object path escaped the filesystem S3 root");
    }
    if (!existing.isDirectory()) {
      throw new Error("filesystem S3 object path collided with a non-directory entry");
    }
  }
}

async function safeDirectoryState(root: string, targetDir: string): Promise<"exists" | "missing"> {
  assertInsideRoot(root, targetDir);
  try {
    const entry = await lstat(targetDir);
    if (entry.isSymbolicLink()) {
      throw new Error("resolved object path escaped the filesystem S3 root");
    }
    if (!entry.isDirectory()) {
      throw new Error("filesystem S3 object path collided with a non-directory entry");
    }
    const resolved = await realpath(targetDir);
    assertInsideRoot(root, resolved);
    return "exists";
  } catch (error) {
    if (isNotFoundError(error)) return "missing";
    throw error;
  }
}

async function safeFileState(root: string, path: string): Promise<"exists" | "missing"> {
  assertInsideRoot(root, path);
  try {
    const entry = await lstat(path);
    if (entry.isSymbolicLink()) {
      throw new Error("resolved object path escaped the filesystem S3 root");
    }
    if (!entry.isFile()) {
      throw new Error("filesystem S3 object path collided with a non-file entry");
    }
    const resolved = await realpath(path);
    assertInsideRoot(root, resolved);
    return "exists";
  } catch (error) {
    if (isNotFoundError(error)) return "missing";
    throw error;
  }
}

async function assertReplaceTargetIsSafe(root: string, path: string): Promise<void> {
  const state = await safeFileState(root, path);
  if (state === "missing") {
    return;
  }
}

function assertInsideRoot(root: string, targetPath: string): void {
  const relativePath = relative(root, targetPath);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return;
  }
  throw new Error("resolved object path escaped the filesystem S3 root");
}

async function writeNewFileNoFollow(path: string, content: string): Promise<void> {
  const file = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    await file.writeFile(content, "utf8");
  } finally {
    await file.close();
  }
}

async function readFileNoFollow(path: string): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const fileStat = await file.stat();
    if (!fileStat.isFile()) {
      throw new Error("filesystem S3 object path collided with a non-file entry");
    }
    return await file.readFile("utf8");
  } finally {
    await file.close();
  }
}

function objectFilePath(objectsDir: string, key: string): string {
  return join(objectsDir, `${encodeObjectKey(key)}.json`);
}

function encodeObjectKey(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}

function parseStoredObject(objectText: string): StoredObject {
  const parsed = JSON.parse(objectText) as StoredObject;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.body !== "string" ||
    typeof parsed.contentType !== "string" ||
    typeof parsed.metadata !== "object" ||
    parsed.metadata === null ||
    Array.isArray(parsed.metadata)
  ) {
    throw new Error("filesystem S3 object metadata is invalid");
  }
  for (const [key, value] of Object.entries(parsed.metadata)) {
    if (typeof key !== "string" || typeof value !== "string") {
      throw new Error("filesystem S3 object metadata is invalid");
    }
  }
  return { body: parsed.body, contentType: parsed.contentType, metadata: { ...parsed.metadata } };
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function randomNonce(): string {
  return randomBytes(8).toString("base64url");
}
