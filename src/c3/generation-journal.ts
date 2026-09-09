import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { canonicalJson } from './context.ts';
import type { C3VerificationRequest } from './generation-contract-v6.ts';
import type { C3GenerationRecord, C3ModelRequest } from './draft.ts';
import type { C3GenerationAudit, C3TransportFailure } from './provider.ts';

/** Append-only private attempt evidence. Separate from work saves and account stores. */
export class C3GenerationJournal implements C3GenerationAudit {
  readonly root: string;
  constructor(root: string) {
    this.root = resolve(root);
    const repo = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
    const outside = relative(repo, this.root);
    if (!(outside === '..' || outside.startsWith(`..${sep}`) || isAbsolute(outside))) throw new Error('Generation audit must be outside the repository.');
    mkdirSync(this.root, { mode: 0o700, recursive: true });
    this.assertRoot();
  }
  private assertRoot(): void {
    const info = lstatSync(this.root);
    if (!info.isDirectory() || info.isSymbolicLink() || realpathSync(this.root) !== this.root ||
        (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error('Generation audit requires an owned private real directory.');
  }
  private append(stage: string, value: unknown): void {
    this.assertRoot();
    const bytes = canonicalJson(value) + '\n';
    if (Buffer.byteLength(bytes, 'utf8') > 16 * 1024 * 1024) throw new Error('Generation audit entry exceeds bound.');
    const dir = openSync(this.root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      const name = `${stage}-${randomBytes(24).toString('hex')}.json`;
      const fd = openSync(resolve(this.root, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        if (!fstatSync(fd).isFile()) throw new Error('Generation audit entry must be a regular file.');
        writeFileSync(fd, bytes); fsyncSync(fd);
      } finally { closeSync(fd); }
      fsyncSync(dir);
    } finally { closeSync(dir); }
  }
  async retainCandidate(request: C3ModelRequest, rawResponse: string): Promise<void> {
    this.append('candidate', { kind: 'atliera.c3.original-generation-attempt', schemaVersion: '1', request, rawResponse });
  }
  async retainFailure(request: C3ModelRequest | C3VerificationRequest, failure: C3TransportFailure): Promise<void> {
    this.append('failed-transport', {request, failure});
  }
  async retainRecord(record: C3GenerationRecord): Promise<void> { this.append('checked', record); }
}
