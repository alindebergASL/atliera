import { lstat, open, type FileHandle } from "node:fs/promises";

export interface ExclusiveArtifact {
  readonly path: string;
  readonly data: string | Uint8Array;
}

const MAX_ARTIFACTS_PER_SET = 32;

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT";
}

async function assertDestinationAbsent(path: string): Promise<void> {
  try {
    await lstat(path);
  } catch (error) {
    if (isNotFound(error)) return;
    throw error;
  }
  throw new Error(`exclusive artifact destination already exists: ${path}`);
}

async function closeBestEffort(handles: readonly FileHandle[]): Promise<void> {
  await Promise.all(handles.map(async (handle) => {
    try {
      await handle.close();
    } catch {
      // Preserve the primary refusal.
    }
  }));
}

/**
 * Creates one bounded generated-artifact set only when every destination is
 * absent. The full-set preflight prevents predictable partial output, while
 * each final open uses `wx` so a destination created after preflight still
 * fails closed instead of being overwritten.
 */
export async function writeExclusiveArtifactSet(
  artifacts: readonly ExclusiveArtifact[],
): Promise<void> {
  if (artifacts.length === 0 || artifacts.length > MAX_ARTIFACTS_PER_SET) {
    throw new Error(`exclusive artifact set must contain 1-${MAX_ARTIFACTS_PER_SET} outputs`);
  }
  const paths = artifacts.map((artifact) => artifact.path);
  if (paths.some((path) => path.length === 0 || path.includes("\0")) ||
      new Set(paths).size !== paths.length) {
    throw new Error("exclusive artifact set paths must be non-empty, NUL-free, and unique");
  }

  await Promise.all(paths.map(assertDestinationAbsent));

  const handles: FileHandle[] = [];
  try {
    for (const path of paths) {
      const handle = await open(path, "wx");
      handles.push(handle);
      const stats = await handle.stat({ bigint: true });
      if (!stats.isFile()) {
        throw new Error(`exclusive artifact destination is not a regular file: ${path}`);
      }
    }
    for (let index = 0; index < artifacts.length; index += 1) {
      await handles[index]!.writeFile(artifacts[index]!.data, { encoding: "utf8" });
    }
    for (const handle of handles) await handle.sync();
    for (const handle of handles) await handle.close();
  } catch (error) {
    await closeBestEffort(handles);
    // Retain remnants: Node pathname deletion cannot atomically bind dev+ino,
    // so any cleanup unlink would have a substitution race.
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error("exclusive artifact destination already exists", { cause: error });
    }
    throw error;
  }
}
