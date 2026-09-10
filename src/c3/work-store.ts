import { constants, openSync, closeSync, fstatSync, fsyncSync, readSync, writeFileSync, mkdirSync, lstatSync, realpathSync, opendirSync, unlinkSync, linkSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { canonicalJson } from './context.ts';
import { deepFreezeOwnData } from '../authority/strict-json.ts';
import { acquireWorkStoreLock } from './work-store-lock.ts';
import { assertReplayIdentity, createC3RevisionContext, type C3GenerationRecord, type C3RevisionContext } from './generation-contract.ts';
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
  /** Trusted operator custody lookup. It must use exact admitted identities, never runtime labels.
   * Supply the same custody authority after restart to validate persisted origin receipts. */
  readonly originReceipt?: (record: C3GenerationRecord) => RecordOriginReceipt | undefined;
  /** Exact operator-retained contexts for legacy schema 1/2 records. Never fetched or
   * inferred from refreshed sources. Reading does not migrate or rewrite old bytes. */
  readonly retainedContexts?: readonly FrozenC3ViewContext[];
  readonly now?: () => Date;
  /** Deterministic filesystem failure seam; not exposed by CLI or HTTP. */
  readonly fault?: (stage: 'before-publish' | 'after-link' | 'after-publish') => void;
}
export interface StoredBrief { readonly kind: 'atliera.c3.private-work'; readonly schemaVersion: '1' | '2' | '3'; readonly contextCanonicalJson?: string; readonly principal: string; readonly accountId: string; readonly contextSha256: string; readonly documentId: string; readonly version: number; readonly work: WorkingBrief; readonly metadata?: WorkMetadata; }
export interface LoadedWorkBrief { readonly saved: StoredBrief; readonly context: FrozenC3ViewContext; }
export interface WorkStoreListing { readonly briefs: readonly StoredBrief[]; readonly unreadableDocumentIds: readonly string[]; }
export type WorkOrigin = 'live' | 'historical-replay' | 'synthetic' | 'unknown';
export interface RecordOriginReceipt {
  readonly recordId: string;
  readonly contextSha256: string;
  readonly modelRequestSha256: string;
  readonly rawResponseSha256: string;
  readonly recordSha256: string;
  readonly origin: Exclude<WorkOrigin, 'unknown'>;
  readonly custodyReceiptId: string;
}
export interface WorkMetadata {
  readonly title?: string;
  readonly savedAt: string;
  readonly origins: readonly RecordOriginReceipt[];
}
/** Creates an identity binding, not an authorization. Only an operator custody lookup admits it. */
export function createRecordOriginReceipt(record: C3GenerationRecord, origin: RecordOriginReceipt['origin'], custodyReceiptId: string): RecordOriginReceipt {
  return {recordId:record.recordId,contextSha256:record.contextSha256,modelRequestSha256:record.modelRequestSha256,
    rawResponseSha256:record.rawResponseSha256,recordSha256:createHash('sha256').update(canonicalJson(record)).digest('hex'),origin,custodyReceiptId};
}
export function workTitle(value: unknown): string {
  if(typeof value !== 'string' || value.length > 160 || value.trim().length === 0 || /[\u0000-\u001f\u007f]/u.test(value)) throw Error('Title must contain 1–160 characters on one line');
  return value;
}
export function defaultWorkTitle(record: C3GenerationRecord): string {
  return workTitle(record.meetingRequest.intendedOutcome.replace(/[\u0000-\u001f\u007f]/gu,' ').trim().slice(0,160));
}
export function validateOriginReceipt(receipt: RecordOriginReceipt, record: C3GenerationRecord): void {
  if (!receipt || !['live','historical-replay','synthetic'].includes(receipt.origin) || typeof receipt.custodyReceiptId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/u.test(receipt.custodyReceiptId) ||
      canonicalJson(receipt) !== canonicalJson(createRecordOriginReceipt(record,receipt.origin,receipt.custodyReceiptId))) throw Error('Origin receipt identity mismatch');
}

export const newWorkDocumentId = (): string => `doc_${randomBytes(12).toString('hex')}`;
const safeDocument = (id: string): string => { if (!/^doc_[a-f0-9]{24}$/u.test(id)) throw Error('Invalid document identifier'); return id; };
export const MAX_WORK_DOCUMENTS = 100;
const MAX_BYTES = 8 * 1024 * 1024;
const repo = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
function exactRecord(record: C3GenerationRecord, context: FrozenC3ViewContext): void {
  assertReplayIdentity(record, context);
  if (record.outcome !== 'succeeded') throw Error('Stored generation is not canonical successful content');
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
  private readonly contexts = new Map<string, FrozenC3ViewContext>();
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
    for (const retained of [context, ...(options.retainedContexts ?? [])]) {
      const checked=this.checkContext(retained.canonicalJson,retained.sha256);
      if(canonicalJson(retained.context)!==checked.canonicalJson) throw Error('Retained context projection mismatch');
      this.contexts.set(checked.sha256,checked);
    }
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
      if(value.kind !== 'atliera.c3.private-work' || !['1','2','3'].includes(value.schemaVersion) || value.principal !== this.options.principal || value.accountId !== this.context.context.account.accountId || !Number.isSafeInteger(value.version) || value.version<1 || value.version>999999 || name !== this.filename(value.documentId,value.version)) throw Error('Work account, principal or version mismatch');
      this.contextFor(value);
      if (value.schemaVersion === '1') {
        if (Object.hasOwn(value,'metadata')) throw Error('Legacy work cannot claim versioned metadata');
      } else this.validateMetadata(value.metadata,value.work);
      return value;
    } finally {closeSync(fd);}
  }
  private validateMetadata(metadata: WorkMetadata | undefined, work: WorkingBrief): void {
    if (!metadata || Object.keys(metadata).some(key=>!['title','savedAt','origins'].includes(key)) ||
        typeof metadata.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(metadata.savedAt) ||
        !Number.isFinite(Date.parse(metadata.savedAt)) || new Date(metadata.savedAt).toISOString() !== metadata.savedAt ||
        !Array.isArray(metadata.origins) || metadata.origins.length > 22) throw Error('Invalid saved work metadata');
    if(Object.hasOwn(metadata,'title')) workTitle(metadata.title);
    const records=[...work.records,...(work.proposal?[work.proposal]:[])];
    const seen=new Set<string>();
    for(const receipt of metadata.origins) {
      const record=records.find(item=>item.recordId===receipt?.recordId);
      if(!record || seen.has(record.recordId)) throw Error('Origin receipt does not belong to work');
      validateOriginReceipt(receipt,record); seen.add(record.recordId);
      const trusted=this.options.originReceipt?.(record);
      if(!trusted || canonicalJson(trusted)!==canonicalJson(receipt)) throw Error('Origin receipt is not admitted by operator custody');
    }
  }
  /** Resolves only explicitly trusted custody. No provider name, contract marker or stored label grants origin. */
  origin(record: C3GenerationRecord): WorkOrigin {
    const receipt=this.options.originReceipt?.(record);
    if(!receipt)return 'unknown';
    validateOriginReceipt(receipt,record); return receipt.origin;
  }
  private filename(id:string,version:number):string { return `${this.prefix}${safeDocument(id)}.v${String(version).padStart(6,'0')}.json`; }
  load(id:string):StoredBrief {
    const names=this.versions(id);
    if(!names.length) throw Error('Saved work unavailable for this account and operator');
    try { return this.read(names.at(-1)!); }
    catch(error) {
      // Publication may have completed just before process death, leaving its private
      // staging hardlink attached. Recover only staging names, then retry the SAME
      // latest version. Corruption never selects an older version.
      try { this.recoverInterruptedSave(); } catch { throw error; }
      return this.read(names.at(-1)!);
    }
  }
  /** Removes only abandoned staging names while holding the kernel lock. Published
   * JSON bytes and versions are never rewritten, deleted, repaired or rolled back. */
  recoverInterruptedSave(): void {
    this.assertRoot(); const dir=acquireWorkStoreLock(this.root);
    try { this.cleanPendingFiles(dir); } finally { closeSync(dir); }
  }
  private cleanPendingFiles(dir: number): void {
    this.assertRoot(); const names=this.files(); let changed=false;
    const published=names.filter(name=>/^[a-f0-9]{32}-doc_[a-f0-9]{24}\.v[0-9]{6}\.json$/u.test(name));
    for(const name of names.filter(name=>/^\.pending-[a-f0-9]{32}$/u.test(name))) {
      const path=resolve(this.root,name); const stat=lstatSync(path);
      if(!stat.isFile() || stat.isSymbolicLink() || stat.uid!==process.getuid?.() || (stat.mode & 0o077)!==0) continue;
      if(stat.nlink===2) {
        const matches=published.filter(candidate=>{
          const target=lstatSync(resolve(this.root,candidate));
          return target.isFile() && !target.isSymbolicLink() && target.dev===stat.dev && target.ino===stat.ino;
        });
        if(matches.length!==1) continue;
      } else if(stat.nlink!==1) continue;
      unlinkSync(path); changed=true;
    }
    if(changed) fsyncSync(dir);
  }
  private documentIds(): string[] {
    const pattern=new RegExp('^'+this.prefix+'doc_[a-f0-9]{24}\\.v[0-9]{6}\\.json$','u');
    return [...new Set(this.files().filter(name=>pattern.test(name)).map(name=>name.slice(this.prefix.length,this.prefix.length+28)))].sort();
  }
  /** Latest-only: an unreadable latest version is reported, never silently rolled back. */
  listWithDiagnostics(): WorkStoreListing {
    const briefs:StoredBrief[]=[]; const unreadableDocumentIds:string[]=[];
    for(const id of this.documentIds()) {
      try { briefs.push(this.load(id)); } catch { unreadableDocumentIds.push(id); }
    }
    return {briefs,unreadableDocumentIds};
  }
  list(): StoredBrief[] { return [...this.listWithDiagnostics().briefs]; }
  private checkContext(serialized: string, digest: string): FrozenC3ViewContext {
    if(typeof serialized!=='string' || Buffer.byteLength(serialized)>MAX_BYTES ||
       !/^[a-f0-9]{64}$/u.test(digest) || createHash('sha256').update(serialized).digest('hex')!==digest) throw Error('Retained context digest mismatch');
    const context=JSON.parse(serialized) as FrozenC3ViewContext['context'];
    if(canonicalJson(context)!==serialized || context?.account?.accountId!==this.context.context.account.accountId) throw Error('Retained context account or canonical identity mismatch');
    return Object.freeze({context:deepFreezeOwnData(context),canonicalJson:serialized,sha256:digest});
  }
  /** Used by the service for historical rendering, evidence inspection and revision.
   * Always validates the complete work against the exact original context. */
  contextFor(saved: StoredBrief): FrozenC3ViewContext {
    if(saved.principal!==this.options.principal || saved.accountId!==this.context.context.account.accountId) throw Error('Work account or principal mismatch');
    let context:FrozenC3ViewContext|undefined;
    if(saved.schemaVersion==='3') context=this.checkContext(saved.contextCanonicalJson!,saved.contextSha256);
    else {
      if(!['1','2'].includes(saved.schemaVersion) || Object.hasOwn(saved,'contextCanonicalJson')) throw Error('Invalid legacy context envelope');
      context=this.contexts.get(saved.contextSha256);
    }
    if(!context) throw Error('Exact original context unavailable for historical work');
    validateWorkingBrief(saved.work,context);
    return context;
  }
  loadWithContext(id: string): LoadedWorkBrief {
    const saved=this.load(id); return {saved,context:this.contextFor(saved)};
  }
  save(id:string,expectedVersion:number,work:WorkingBrief,metadata?: Pick<WorkMetadata,'title'>, originalContext?: FrozenC3ViewContext):StoredBrief {
    safeDocument(id);
    const supplied=originalContext ?? this.contexts.get(work.record.contextSha256);
    if(!supplied) throw Error('Exact original context required to Save historical work');
    const context=this.checkContext(supplied.canonicalJson,supplied.sha256);
    if(canonicalJson(supplied.context)!==context.canonicalJson) throw Error('Retained context projection mismatch');
    validateWorkingBrief(work,context); this.assertRoot();
    if(!Number.isSafeInteger(expectedVersion) || expectedVersion<0 || expectedVersion>=999999) throw Error('Invalid storage version');
    const dir=acquireWorkStoreLock(this.root);
    let temp:string|undefined;
    try {
      this.assertRoot(); this.cleanPendingFiles(dir);
      const names=this.versions(id); const prior=names.length?this.read(names.at(-1)!):undefined;
      if((prior?.version ?? 0)!==expectedVersion) throw Error('Save conflict. Local work kept. Reopen the saved brief or Save a copy.');
      if(prior && prior.contextSha256!==context.sha256) throw Error('Saved document original context cannot change. Save a copy.');
      if(!prior && this.documentIds().length>=MAX_WORK_DOCUMENTS) throw Error('Private work document limit reached. Local work kept.');
      if(this.files().length>=4090) throw Error('Private work store entry limit reached');
      const records=[...work.records,...(work.proposal?[work.proposal]:[])];
      const origins=records.flatMap(record=>{const receipt=this.options.originReceipt?.(record);return receipt?[receipt]:[];});
      const savedMetadata:WorkMetadata={title:workTitle(metadata?.title ?? prior?.metadata?.title ?? defaultWorkTitle(work.record)),savedAt:(this.options.now?.() ?? new Date()).toISOString(),origins};
      this.validateMetadata(savedMetadata,work);
      const value:StoredBrief={kind:'atliera.c3.private-work',schemaVersion:'3',contextCanonicalJson:context.canonicalJson,principal:this.options.principal,accountId:this.context.context.account.accountId,contextSha256:context.sha256,documentId:id,version:expectedVersion+1,work,metadata:savedMetadata};
      const bytes=canonicalJson(value)+'\n'; if(Buffer.byteLength(bytes)>MAX_BYTES) throw Error('Work record exceeds private storage limit');
      temp=resolve(this.root,`.pending-${randomBytes(16).toString('hex')}`);
      const fd=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
      try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
      this.options.fault?.('before-publish'); this.assertRoot();
      const name=this.filename(id,value.version);
      linkSync(temp,resolve(this.root,name)); this.options.fault?.('after-link'); unlinkSync(temp); temp=undefined; fsyncSync(dir);
      this.options.fault?.('after-publish');
      const readback=this.read(name);
      if(canonicalJson(readback)!==canonicalJson(value)) throw Error('Save readback mismatch. Reopen or Save a copy.');
      return readback;
    } finally {
      if(temp)try{unlinkSync(temp);}catch{/* preserve the original failure */}
      closeSync(dir);
    }
  }
}
