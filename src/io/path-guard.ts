import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

export interface GuardOutputPathOptions {
  outputRoot: string;
  targetPath: string;
  allowOverwrite?: boolean;
  rejectRepoPaths?: boolean;
  repoRoot?: string | null;
}

export interface GuardedOutputPath {
  outputRoot: string;
  targetPath: string;
  targetDirectory: string;
}

export async function guardOutputPath(options: GuardOutputPathOptions): Promise<GuardedOutputPath> {
  const outputRoot = await resolveExistingOutputRoot(options.outputRoot);
  const targetPath = resolve(options.targetPath);
  const targetDirectory = dirname(targetPath);

  if (!isInside(outputRoot, targetPath)) {
    throw new PathGuardError(`target path is outside output root: ${targetPath}`);
  }

  rejectGitPath(outputRoot, targetPath);

  const existingTarget = await statIfExists(targetPath);
  if (existingTarget) {
    if (!options.allowOverwrite) {
      throw new PathGuardError(`target path already exists; pass allowOverwrite to replace it: ${targetPath}`);
    }
    if (existingTarget.isSymbolicLink()) {
      const targetRealPath = await realpath(targetPath).catch(() => null);
      if (targetRealPath && !isInside(outputRoot, targetRealPath)) {
        throw new PathGuardError(`target path follows a symlink escape outside output root: ${targetPath}`);
      }
      if (targetRealPath) {
        rejectGitPath(outputRoot, targetRealPath);
      }
    }
  }

  const existingParent = await deepestExistingParent(targetDirectory);
  const realParent = await realpath(existingParent);
  if (!isInside(outputRoot, realParent)) {
    throw new PathGuardError(`target parent follows a symlink escape outside output root: ${targetDirectory}`);
  }
  rejectGitPath(outputRoot, realParent);

  if (!isInside(outputRoot, targetDirectory)) {
    throw new PathGuardError(`target directory is outside output root: ${targetDirectory}`);
  }

  if (options.repoRoot) {
    const repoRoot = await realpath(resolve(options.repoRoot));
    if (isInside(repoRoot, targetPath)) {
      if (await isGitTracked(repoRoot, targetPath)) {
        throw new PathGuardError(`target path is git-tracked and cannot be overwritten: ${targetPath}`);
      }
      if (options.rejectRepoPaths !== false) {
        throw new PathGuardError(`target path is inside the repository working tree: ${targetPath}`);
      }
    }
  }

  return { outputRoot, targetPath, targetDirectory };
}

async function resolveExistingOutputRoot(path: string): Promise<string> {
  try {
    return await realpath(resolve(path));
  } catch {
    throw new PathGuardError(`output root must exist before guarded writes: ${resolve(path)}`);
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function rejectGitPath(outputRoot: string, targetPath: string): void {
  const rel = relative(outputRoot, targetPath);
  const parts = rel.split(sep).filter(Boolean);
  if (parts.includes(".git")) {
    throw new PathGuardError(`target path must not write inside .git: ${targetPath}`);
  }
}

async function deepestExistingParent(path: string): Promise<string> {
  let current = resolve(path);
  while (!(await pathExists(current))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new PathGuardError(`no existing parent directory found for target path: ${path}`);
    }
    current = parent;
  }
  return current;
}

async function statIfExists(path: string) {
  try {
    return await lstat(path);
  } catch {
    return null;
  }
}

async function pathExists(path: string): Promise<boolean> {
  return (await statIfExists(path)) !== null;
}

async function isGitTracked(repoRoot: string, targetPath: string): Promise<boolean> {
  const relativePath = relative(repoRoot, targetPath);
  try {
    await execFileAsync("git", ["-C", repoRoot, "ls-files", "--error-unmatch", "--", relativePath]);
    return true;
  } catch (e) {
    const code = typeof e === "object" && e !== null && "code" in e ? (e as { code?: unknown }).code : undefined;
    if (code === 1) return false;
    throw new PathGuardError(`unable to determine git tracking status for target path: ${targetPath}`);
  }
}
