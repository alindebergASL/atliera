import { constants, openSync, closeSync, fstatSync, readSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAccountResearchConfiguration, type AccountResearchConfiguration } from './research-service.ts';
/** Private operator file only. Parsing is inert; never dispatches or treats a reference as approval. */
export function readResearchConfiguration(path: string, enable: boolean, accounts: readonly string[], work?: { principal: string; root: string }): readonly AccountResearchConfiguration[] {
  const repo = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
  const rel = relative(repo, path);
  if (!isAbsolute(path) || realpathSync(path) !== path || !(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) throw Error('Research configuration must be private and outside the repository');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.() || stat.size > 32_000) throw Error('Unsafe research configuration file');
    const buffer = Buffer.alloc(stat.size + 1); let count = 0;
    while (count < buffer.length) { const read = readSync(fd, buffer, count, buffer.length - count, null); if (!read) break; count += read; }
    const bytes = buffer.subarray(0, count);
    if (bytes.length !== stat.size || fstatSync(fd).mtimeMs !== stat.mtimeMs) throw Error('Research configuration changed during read');
    const values: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!Array.isArray(values) || !values.length || values.length > accounts.length) throw Error('Expected per-account research configurations');
    const configs = values.map(value => {
      if (!value || !accounts.includes(value.accountId)) throw Error('Unknown research account');
      const config = validateAccountResearchConfiguration(value, value.accountId, work?.principal, work?.root);
      return { ...config, enabled: enable && config.enabled };
    });
    if (new Set(configs.map(config => config.accountId)).size !== configs.length || new Set(configs.map(config => config.retentionRoot)).size !== configs.length) throw Error('Duplicate research account or retention root');
    return configs;
  } finally { closeSync(fd); }
}
export function researchLaunchArguments(args: readonly string[]): { recording?: string; configPath?: string; enable: boolean } {
  let recording: string | undefined, configPath: string | undefined, enable = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--research-config' && configPath === undefined) {
      configPath = args[++i]; if (!configPath || configPath.startsWith('--')) throw Error('Research configuration path required');
    } else if (arg === '--enable-research' && !enable) enable = true;
    else if (!arg.startsWith('--') && recording === undefined) recording = arg;
    else throw Error('usage: serve-accounts [UTAH_RECORDING_DIRECTORY] [--research-config PRIVATE_JSON] [--enable-research]');
  }
  if (enable && !configPath) throw Error('--enable-research requires --research-config');
  return { recording, configPath, enable };
}
