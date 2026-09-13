import { constants, openSync, closeSync, fstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandC3ModelProvider } from './provider.ts';
/** Inert, provider-neutral, explicitly selected private operator configuration.
 * A command route is not a dispatch grant; the command must independently admit each request.
 */
export function readAccountModelCommand(path: string, accountId: string, principal: string) {
  const repo = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
  const rel = relative(repo, path);
  if (!isAbsolute(path) || realpathSync(path) !== path || !(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) throw Error('Model command configuration must be private');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid?.() || stat.mode & 0o077 || stat.size > 16_384) throw Error('Unsafe model command configuration');
    const raw = readFileSync(fd);
    if (raw.length !== stat.size || fstatSync(fd).mtimeMs !== stat.mtimeMs) throw Error('Model configuration changed during read');
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    if (!value || Object.keys(value).sort().join(',') !== 'accountId,args,auditRoot,command,principal,timeoutMs' ||
        value.accountId !== accountId || value.principal !== principal || !Number.isInteger(value.timeoutMs) || !Array.isArray(value.args) || value.args.length > 12 ||
        typeof value.command !== 'string' || !isAbsolute(value.command) || typeof value.auditRoot !== 'string' || !isAbsolute(value.auditRoot)) throw Error('Model command account/principal configuration refused');
    return { provider: new CommandC3ModelProvider({ command: value.command, args: value.args, timeoutMs: value.timeoutMs,
      killGraceMs: 15_000, environment: { C3_COMMAND_TIMEOUT_MS: String(value.timeoutMs), C3_COMMAND_KILL_GRACE_MS: '15000' } }), auditRoot: value.auditRoot as string };
  } finally { closeSync(fd); }
}
export function modelCommandLaunchArguments(args: readonly string[]): { modelConfig?: string; remaining: string[] } {
  const remaining: string[] = []; let modelConfig: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--model-command-config') { remaining.push(args[i]!); continue; }
    if (modelConfig) throw Error('Duplicate model command configuration');
    modelConfig = args[++i]; if (!modelConfig || modelConfig.startsWith('--')) throw Error('Explicit model command configuration path required');
  }
  return { modelConfig, remaining };
}
