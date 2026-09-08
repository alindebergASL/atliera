import { constants, openSync, closeSync, fstatSync, fsyncSync, readSync, writeFileSync, mkdirSync, lstatSync, realpathSync, opendirSync, unlinkSync, rmdirSync, linkSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { canonicalJson } from './context.ts';
import { assertReplayIdentity, createC3RevisionContext, createC3ModelRequest, createGenerationRecord, type C3GenerationRecord, type C3RevisionContext } from './draft.ts';
import { boundedPlanningText, MEETING_NOTE_SECTIONS } from './planning.ts';
import type { FrozenC3ViewContext } from './view-context.ts';

export interface WorkingBrief {
  readonly record: C3GenerationRecord;
  readonly records: readonly C3GenerationRecord[];
  readonly correctionNote: string;
  readonly sectionNotes: Readonly<Record<string,string>>;
  readonly instruction: string;
  readonly pendingRevision: C3RevisionContext | null;
  readonly pendingRevisionToken: string | null;
  readonly proposal: C3GenerationRecord | null;
  readonly proposalStale: boolean;
  readonly workVersion: number;
}
export interface WorkStoreOptions {
  readonly root: string;
  /** Operator configuration only. Never taken from cookies, headers or request bodies. */
  readonly principal: string;
  /** Deterministic filesystem failure seam; not exposed by CLI or HTTP. */
  readonly fault?: (stage: 'before-publish' | 'after-publish') => void;
}
export interface StoredBrief { readonly kind: 'atliera.c3.private-work'; readonly schemaVersion: '1'; readonly principal: string; readonly accountId: string; readonly contextSha256: string; readonly documentId: string; readonly version: number; readonly work: WorkingBrief; }
export const newWorkDocumentId = (): string => `doc_${randomBytes(12).toString('hex')}`;
const safeDocument = (id: string): string => { if (!/^doc_[a-f0-9]{24}$/u.test(id)) throw Error('Invalid document identifier'); return id; };
const MAX_BYTES = 8 * 1024 * 1024;
const repo = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
function exactRecord(record: C3GenerationRecord, context: FrozenC3ViewContext): void {
  assertReplayIdentity(record, context);
  const rebuilt = createGenerationRecord(createC3ModelRequest(context, record.meetingRequest, record.revision), record.rawResponse, context);
  if (canonicalJson(rebuilt) !== canonicalJson(record) || record.outcome !== 'succeeded') throw Error('Stored generation is not canonical successful content');
}
export function validateWorkingBrief(work: WorkingBrief, context: FrozenC3ViewContext): void {
  if (!work || typeof work.proposalStale !== 'boolean' || !Number.isSafeInteger(work.workVersion) || work.workVersion < 1 || !Array.isArray(work.records) || work.records.length < 1 || work.records.length > 21) throw Error('Invalid work history');
  const seen = new Map<string,C3GenerationRecord>();
  for (const record of work.records) {
    exactRecord(record,context);
    if (record.revision) {
      const prior = seen.get(record.revision.priorRecordId);
      if (!prior || canonicalJson(createC3RevisionContext(prior,record.revision.correctionNote,(prior.revision?.revisionNumber ?? 0)+1)) !== canonicalJson(record.revision)) throw Error('Stored revision ancestry mismatch');
    } else if (seen.size) throw Error('Unrelated generation in work history');
    if (seen.has(record.recordId)) throw Error('Repeated record');
    seen.set(record.recordId,record);
  }
  if (canonicalJson(work.records.at(-1)) !== canonicalJson(work.record)) throw Error('Current work identity mismatch');
  boundedPlanningText(work.correctionNote,1000); boundedPlanningText(work.instruction,1000);
  if (!work.sectionNotes || Array.isArray(work.sectionNotes) || typeof work.sectionNotes !== 'object') throw Error('Invalid annotations');
  for (const [section,text] of Object.entries(work.sectionNotes)) {
    if (!MEETING_NOTE_SECTIONS.includes(section as typeof MEETING_NOTE_SECTIONS[number])) throw Error('Invalid annotation section');
    boundedPlanningText(text,1000);
  }
  if (work.pendingRevision === null) {
    if (work.pendingRevisionToken !== null || work.proposal !== null) throw Error('Orphan proposal');
  } else {
    if (typeof work.pendingRevisionToken !== 'string' || !/^[A-Za-z0-9_-]{32}$/u.test(work.pendingRevisionToken) ||
        canonicalJson(createC3RevisionContext(work.record,work.pendingRevision.correctionNote,(work.record.revision?.revisionNumber ?? 0)+1)) !== canonicalJson(work.pendingRevision)) throw Error('Pending revision identity mismatch');
    if (work.proposal) {
      exactRecord(work.proposal,context);
      if (canonicalJson(work.proposal.revision) !== canonicalJson(work.pendingRevision) || canonicalJson(work.proposal.meetingRequest) !== canonicalJson(work.record.meetingRequest)) throw Error('Proposal identity mismatch');
    }
  }
}
/** Private immutable versions. An exclusive root lock serializes CAS across server processes.
 * No good version is overwritten, including when readback/acknowledgement fails after publication.
 */
export class LocalWorkStore {
  readonly root: string;
  private readonly prefix: string;
  constructor(private readonly options: WorkStoreOptions, private readonly context: FrozenC3ViewContext) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.@-]{2,127}$/u.test(options.principal)) throw Error('A stable operator principal is required for private storage');
    if (!isAbsolute(options.root)) throw Error('Work store requires an absolute external root');
    this.root=resolve(options.root);
    const rel=relative(repo,this.root);
    if (!(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))) throw Error('Work store must be outside the source repository');
    try { mkdirSync(this.root,{mode:0o700}); } catch(error) { if((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    this.assertRoot();
    const accountId=context.context.account.accountId;
    if (!/^[A-Za-z0-9_-]{1,120}$/u.test(accountId)) throw Error('Unsafe account identifier');
    this.prefix=createHash('sha256').update(canonicalJson([options.principal,accountId])).digest('hex').slice(0,32)+'-';
  }
  private assertRoot(): void {
    const stat=lstatSync(this.root);
    if (!stat.isDirectory() || stat.isSymbolicLink() || realpathSync(this.root) !== this.root || (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.()) throw Error('Work root must be a private owned real directory without symlink ancestors');
  }
  private files(): string[] {
    this.assertRoot(); const names:string[]=[];const directory=opendirSync(this.root);
    try {let item;while((item=directory.readSync())!==null){names.push(item.name);if(names.length>4096)throw Error('Private work store entry limit reached');}}
    finally{directory.closeSync();}
    return names;
  }
  private versions(id:string): string[] {
    safeDocument(id); const pattern=new RegExp('^'+this.prefix+id+'\\.v[0-9]{6}\\.json$','u');
    return this.files().filter(name=>pattern.test(name)).sort();
  }
  private read(name:string): StoredBrief {
    const fd=openSync(resolve(this.root,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    try {
      const stat=fstatSync(fd);
      if(!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_BYTES || (stat.mode & 0o077)!==0 || stat.uid !== process.getuid?.()) throw Error('Unsafe or oversized work record');
      const buffer=Buffer.alloc(stat.size+1);let size=0;
      while(size<buffer.length){const count=readSync(fd,buffer,size,buffer.length-size,null);if(count===0)break;size+=count;}
      const after=fstatSync(fd);
      if(size!==stat.size || after.size!==stat.size || after.mtimeMs!==stat.mtimeMs) throw Error('Work record changed during bounded read');
      const bytes=buffer.subarray(0,size);
      const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as StoredBrief;
      if(value.kind !== 'atliera.c3.private-work' || value.schemaVersion !== '1' || value.principal !== this.options.principal || value.accountId !== this.context.context.account.accountId || value.contextSha256 !== this.context.sha256 || !Number.isSafeInteger(value.version) || value.version<1 || value.version>999999 || name !== this.filename(value.documentId,value.version)) throw Error('Work account, principal or version mismatch');
      validateWorkingBrief(value.work,this.context); return value;
    } finally {closeSync(fd);}
  }
  private filename(id:string,version:number):string { return `${this.prefix}${safeDocument(id)}.v${String(version).padStart(6,'0')}.json`; }
  load(id:string):StoredBrief { const names=this.versions(id); if(!names.length) throw Error('Saved work unavailable for this account and operator'); return this.read(names.at(-1)!); }
  list(): StoredBrief[] {
    const ids=new Set(this.files().filter(name=>name.startsWith(this.prefix) && /doc_[a-f0-9]{24}\.v[0-9]{6}\.json$/u.test(name)).map(name=>name.slice(this.prefix.length,this.prefix.length+28)));
    if(ids.size>100) throw Error('Private work document limit reached');
    return [...ids].map(id=>this.load(id));
  }
  save(id:string,expectedVersion:number,work:WorkingBrief):StoredBrief {
    safeDocument(id); validateWorkingBrief(work,this.context); this.assertRoot();
    if(!Number.isSafeInteger(expectedVersion) || expectedVersion<0 || expectedVersion>=999999) throw Error('Invalid storage version');
    const lock=resolve(this.root,'.write-lock');
    try {mkdirSync(lock,{mode:0o700});} catch {throw Error('Work store busy. Local work kept; retry Save.');}
    let temp:string|undefined; let dir:number|undefined;
    try {
      this.assertRoot(); dir=openSync(this.root,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
      const names=this.versions(id); const prior=names.length?this.read(names.at(-1)!):undefined;
      if((prior?.version ?? 0)!==expectedVersion) throw Error('Save conflict. Local work kept. Reopen the saved brief or Save a copy.');
      if(this.files().length>=4090) throw Error('Private work store entry limit reached');
      const value:StoredBrief={kind:'atliera.c3.private-work',schemaVersion:'1',principal:this.options.principal,accountId:this.context.context.account.accountId,contextSha256:this.context.sha256,documentId:id,version:expectedVersion+1,work};
      const bytes=canonicalJson(value)+'\n'; if(Buffer.byteLength(bytes)>MAX_BYTES) throw Error('Work record exceeds private storage limit');
      temp=resolve(this.root,`.pending-${randomBytes(16).toString('hex')}`);
      const fd=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
      this.options.fault?.('before-publish'); this.assertRoot();
      const name=this.filename(id,value.version);
      linkSync(temp,resolve(this.root,name)); unlinkSync(temp); temp=undefined; fsyncSync(dir);
      this.options.fault?.('after-publish');
      const readback=this.read(name);
      if(canonicalJson(readback)!==canonicalJson(value)) throw Error('Save readback mismatch. Reopen or Save a copy.');
      return readback;
    } finally {
      if(temp)try{unlinkSync(temp);}catch{/* preserve the original failure */}
      try{rmdirSync(lock);if(dir!==undefined)fsyncSync(dir);}finally{if(dir!==undefined)closeSync(dir);}
    }
  }
}
