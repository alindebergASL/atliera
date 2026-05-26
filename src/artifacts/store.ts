export interface ArtifactPutTextOptions {
  contentType: string;
  metadata?: Record<string, string>;
}

export interface TextArtifact {
  key: string;
  content: string;
  contentType: string;
  metadata: Record<string, string>;
}

export interface ArtifactStore {
  putText(key: string, content: string, options: ArtifactPutTextOptions): Promise<void>;
  getText(key: string): Promise<TextArtifact | undefined>;
}

const SAFE_ARTIFACT_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const ARTIFACT_METADATA_ERROR = "artifact metadata must be a plain string record";

export function assertSafeArtifactKey(key: string): void {
  if (key.trim() !== key || key.length === 0) {
    throw new Error("artifact key must be a non-empty relative slash-delimited key");
  }

  if (key.startsWith("/") || key.includes("://") || key.includes("\\")) {
    throw new Error("artifact key must be relative and must not include a URL scheme or backslash");
  }

  const segments = key.split("/");
  if (segments.length === 0 || segments.some((segment) => !SAFE_ARTIFACT_SEGMENT.test(segment))) {
    throw new Error(
      "artifact key must contain only safe non-empty path segments and must not include '.', '..', or empty segments",
    );
  }
}

export function copyArtifactMetadata(metadata: Record<string, string> | undefined): Record<string, string> {
  if (metadata === undefined) {
    return {};
  }
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new Error(ARTIFACT_METADATA_ERROR);
  }

  const copy: Record<string, string> = {};
  try {
    for (const key of Object.keys(metadata)) {
      const descriptor = Object.getOwnPropertyDescriptor(metadata, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") {
        throw new Error(ARTIFACT_METADATA_ERROR);
      }
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: descriptor.value,
        writable: true,
      });
    }
  } catch {
    throw new Error(ARTIFACT_METADATA_ERROR);
  }
  return copy;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly artifacts = new Map<string, TextArtifact>();

  async putText(key: string, content: string, options: ArtifactPutTextOptions): Promise<void> {
    assertSafeArtifactKey(key);
    const metadata = copyArtifactMetadata(options.metadata);

    this.artifacts.set(key, {
      key,
      content,
      contentType: options.contentType,
      metadata,
    });
  }

  async getText(key: string): Promise<TextArtifact | undefined> {
    assertSafeArtifactKey(key);

    const artifact = this.artifacts.get(key);
    if (artifact === undefined) {
      return undefined;
    }

    return {
      key: artifact.key,
      content: artifact.content,
      contentType: artifact.contentType,
      metadata: { ...artifact.metadata },
    };
  }
}
