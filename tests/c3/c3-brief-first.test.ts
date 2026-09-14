import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syntheticWorkshopContext, syntheticMeetingRequest, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';
import { startC3Server, type RunningC3Server } from '../../src/c3/service.ts';
import { createC3ModelRequest, createGenerationRecord as createOriginalGenerationRecord } from '../../src/c3/generation-contract.ts';
import { createC3VerificationRequest, retainC3Verification } from '../../src/c3/generation-contract.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';
import { validateAuthoredMeetingCopy } from '../../src/c3/authored-copy.ts';
import { formatBriefExport, generatedReading, authoredReading } from '../../src/c3/brief-first.ts';
import { LocalWorkStore } from '../../src/c3/work-store.ts';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { C3GenerationRecord, C3ModelRequest } from '../../src/c3/generation-contract.ts';

const ctx = syntheticWorkshopContext();
const request = syntheticMeetingRequest;
const createGenerationRecord: typeof createOriginalGenerationRecord = (model, raw, context, verification) => {
  if (!verification) {
    const check = createC3VerificationRequest(model, raw, context);
    verification = retainC3Verification(check, scriptedFullCoverage(check));
  }
  return createOriginalGenerationRecord(model, raw, context, verification);
};
const provider = { name: 'synthetic', executionMode: 'local' as const,
  async generate(model: C3ModelRequest) { return syntheticMeetingCandidate(ctx); },
  async verify(request: unknown) { return Promise.resolve(scriptedFullCoverage(request as Parameters<typeof scriptedFullCoverage>[0])); } };
const startVerifiedC3Server: typeof startC3Server = options => startC3Server(options);

class Response extends EventEmitter {
  status = 200; headers: Record<string, string> = {}; text = ''; writableEnded = false;
  done: Promise<void>; finish!: () => void;
  constructor() { super(); this.done = new Promise(resolve => { this.finish = resolve; }); }
  setHeader(k: string, v: string) { this.headers[k] = v; }
  writeHead(s: number, h: Record<string, string>) { this.status = s; Object.assign(this.headers, h); }
  end(s: string) { this.text = s; this.writableEnded = true; this.finish(); }
}
async function browser(server: RunningC3Server) {
  let cookie = '', csrf = '', documentId = '';
  const call = async (path: string, body?: unknown, displayedDocument?: string) => {
    const req = new PassThrough() as unknown as IncomingMessage;
    Object.assign(req, { method: body === undefined ? 'GET' : 'POST', url: path,
      headers: { host: '127.0.0.1:4317', cookie, origin: server.origin, 'content-type': 'application/json', 'x-c3-csrf': csrf, 'x-c3-document': displayedDocument ?? documentId } });
    const res = new Response(); server.server.emit('request', req, res as unknown as ServerResponse);
    (req as unknown as PassThrough).end(body === undefined ? undefined : JSON.stringify(body)); await res.done;
    if (res.status < 300) { const meta = res.text.match(/name="c3-document" content="([^"]+)"/); if (meta) documentId = meta[1]!;
      if (body !== undefined) { const result = JSON.parse(res.text); if (result.documentId) documentId = result.documentId; } }
    return { status: res.status, text: res.text, headers: res.headers, json: () => JSON.parse(res.text) };
  };
  const home = await call('/'); cookie = home.headers['set-cookie']!.split(';')[0]!; csrf = home.text.match(/name="c3-csrf" content="([^"]+)"/)![1]!;
  return { call };
}
let operation = 0;
const envelope = () => ({ request, recordId: null, pendingRevisionToken: null, operationId: String(++operation).padStart(32, 'x') });

const evidenceIds = ctx.context.admittedSources.flatMap(source => source.excerpts.map(excerpt => excerpt.evidenceId));
const authoredPayload = (recordId: string, refs = evidenceIds.slice(0, 2)) => ({
  provenance: 'user-authored', priorRecordId: recordId,
  title: 'Discovery: research enablement', audience: 'Research computing leads', duration: '15 minutes',
  purpose: 'Understand current access and support priorities.',
  facts: ['The page describes an early-access call.', 'It includes onboarding and training support.', 'It describes conditional quarterly allocations.'],
  interpretation: 'Access may be only the first step; a hypothesis to explore, not evidence of a problem.',
  opening: 'Your materials describe both access and support. I would like to understand where the program stands.',
  questions: [
    { question: 'Where does access stand today, and which groups are your priority?' },
    { question: 'What is working well as researchers get started?', probe: 'onboarding, training or allocation clarity' },
    { question: 'What would successful enablement look like over the next months?' },
  ],
  close: 'Recap the priority identified and agree one next step with an owner.',
  uncertainty: 'The selected material is undated; it does not confirm current availability.',
  selectedEvidenceRefs: refs,
});

test('validator: exact keys, provenance, bounds, context evidence and record binding', () => {
  const record = createGenerationRecord(createC3ModelRequest(ctx, request), syntheticMeetingCandidate(ctx), ctx);
  const copy = validateAuthoredMeetingCopy(authoredPayload(record.recordId), ctx, record.recordId);
  assert.equal(copy.provenance, 'user-authored');
  assert.throws(() => validateAuthoredMeetingCopy({ ...authoredPayload(record.recordId), approved: true }, ctx, record.recordId), /unexpected or missing fields/);
  assert.throws(() => validateAuthoredMeetingCopy({ ...authoredPayload(record.recordId), provenance: 'model' }, ctx, record.recordId), /user-authored/);
  assert.throws(() => validateAuthoredMeetingCopy({ ...authoredPayload('c3_' + '0'.repeat(24)) }, ctx, record.recordId), /different generation record/);
  assert.throws(() => validateAuthoredMeetingCopy({ ...authoredPayload(record.recordId), selectedEvidenceRefs: ['evidence_missing'] }, ctx, record.recordId), /retained in this work context/);
  assert.deepEqual(validateAuthoredMeetingCopy({ ...authoredPayload(record.recordId), facts: [], selectedEvidenceRefs: [] }, ctx, record.recordId).facts, []);
  assert.throws(() => validateAuthoredMeetingCopy({ ...authoredPayload(record.recordId), questions: [{ question: 'a'.repeat(700) }] }, ctx, record.recordId), /bounded/);
});

test('canonical export formatter: shared shape, accurate counts, provenance, no IDs or buttons', () => {
  const record = createGenerationRecord(createC3ModelRequest(ctx, request), syntheticMeetingCandidate(ctx), ctx);
  const generated = formatBriefExport(generatedReading(record, ctx));
  assert.match(generated, /# Clarify priorities/);
  assert.match(generated, /original record unchanged/i);
  assert.match(generated, /\*\*Evidence foundation:\*\* \d+ selected passages? from \d+ sources?/);
  assert.ok(!generated.includes('data-') && !generated.includes('button') && !generated.includes('recordId'), 'no UI debris');
  const copy = validateAuthoredMeetingCopy(authoredPayload(record.recordId), ctx, record.recordId);
  const authored = formatBriefExport(authoredReading(copy, ctx));
  assert.match(authored, /User-authored meeting copy · not a model-generated record/);
  assert.match(authored, /Optional probe: onboarding, training or allocation clarity/);
  assert.match(authored, /## Current status needs confirmation/);
  assert.equal((authored.match(/Optional probe:/gu) || []).length, 1);
});

test('brief-first route: backward-compatible generated reading then authored copy, keep+save+reopen; record unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-brief-first-'));
  const options = { context: ctx, provider, listen: false, workStore: { root, principal: 'operator-one' } };
  const server = await startC3Server(options);
  try {
    const b = await browser(server);
    // Prominent account entry exists before any draft and makes no provider call.
    const home = await b.call('/');
    assert.match(home.text, /No meeting brief yet/);
    const generated = (await b.call('/api/generate', envelope())).json();
    const afterGeneration = await b.call('/');
    assert.match(afterGeneration.text, /Open the one-minute brief/);
    // Backward-compatible projection of the unchanged record.
    const brief = await b.call('/?brief=1');
    assert.match(brief.text, /original record unchanged/i);
    assert.match(brief.text, /Deep evidence, original draft and history/);
    // Authored copy: keep locally, verify version-checked CAS and validation.
    const stale = await b.call('/api/authored-copy', { recordId: generated.recordId, workVersion: 999, copy: authoredPayload(generated.recordId) });
    assert.equal(stale.status, 409);
    const state = (await b.call('/api/work-state', {})).json();
    const kept = await b.call('/api/authored-copy', { recordId: generated.recordId, workVersion: state.workVersion, copy: authoredPayload(generated.recordId) });
    assert.equal(kept.status, 200); assert.equal(kept.json().kept, true); assert.equal(kept.json().noChange, false);
    const authoredPage = await b.call('/?brief=1');
    assert.match(authoredPage.text, /User-authored meeting copy · not a model-generated record/);
    assert.match(authoredPage.text, /Discovery: research enablement/);
    assert.doesNotMatch(authoredPage.text, /original record unchanged/i);
    // Export reflects the kept authored copy through one canonical formatter.
    const exportResult = (await b.call('/api/brief-export', { recordId: generated.recordId, workVersion: kept.json().workVersion })).json();
    assert.equal(exportResult.mode, 'user-authored');
    assert.match(exportResult.exportText, /User-authored meeting copy/);
    assert.ok(!exportResult.exportText.includes(generated.recordId));
    // Explicit Save persists the snapshot including authored copy; the record bytes are unchanged.
    const saved = (await (async () => {
      const state2 = (await b.call('/api/work-state', {})).json();
      return b.call('/api/save', { recordId: generated.recordId, documentId: state2.documentId, expectedVersion: state2.version, workVersion: state2.workVersion });
    })());
    assert.equal(saved.status, 200); assert.equal(saved.json().authoredCopy.provenance, 'user-authored');
    const stored = JSON.parse(await readFile(join(root, (await readdir(root)).find(f => f.endsWith('.json'))!), 'utf8'));
    assert.equal(stored.work.record.recordId, generated.recordId, 'record untouched');
    assert.equal(stored.work.authoredCopy.title, 'Discovery: research enablement');
    // Restart and reopen: authored copy returns; legacy files without it still load.
    await server.close();
    const server2 = await startC3Server(options);
    try {
      const b2 = await browser(server2);
      const reopened = await b2.call('/api/reopen', { documentId: saved.json().documentId });
      assert.equal(reopened.status, 200);
      const page2 = await b2.call('/?brief=1');
      assert.match(page2.text, /User-authored meeting copy/);
      assert.match(page2.text, /Discovery: research enablement/);
    } finally { await server2.close(); }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('store round-trips legacy briefs without the field and rejects unknown authored record binding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-brief-first-legacy-'));
  try {
    // Legacy stored file (no authoredCopy) still validates and reopens: no migration or rewrite.
    const store = new LocalWorkStore({ root, principal: 'operator-one' }, ctx);
    const record = createGenerationRecord(createC3ModelRequest(ctx, request), syntheticMeetingCandidate(ctx), ctx);
    const legacy = { record, records: [record], correctionNote: '', sectionNotes: {}, instruction: '',
      pendingRevision: null, pendingRevisionToken: null, proposal: null, proposalStale: false, workVersion: 1 };
    const saved = store.save('doc_123456789012345678901234', 0, legacy);
    assert.equal(saved.work.authoredCopy, undefined);
    assert.equal(new LocalWorkStore({ root, principal: 'operator-one' }, ctx).load(saved.documentId).work.record.recordId, record.recordId);
    // A saved brief whose authoredCopy is bound to a different record is refused, never silently carried.
    const bad = { ...legacy, workVersion: 2, authoredCopy: authoredPayload('c3_' + '9'.repeat(24)) };
    assert.throws(() => store.save(saved.documentId, 1, bad), /different generation record/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('brief route keeps exact query guards', async () => {
  const { parseWorkspaceRoute } = await import('../../src/c3/workspace-route.ts');
  assert.deepEqual(parseWorkspaceRoute(new URLSearchParams('brief=1')), { destination:'workshop', task:'brief' });
  for (const query of ['brief=1&brief=1','brief=0','brief=1&bogus=1','brief=1&draft=1','brief=1&view=research']) {
    assert.throws(() => parseWorkspaceRoute(new URLSearchParams(query)));
  }
});

test('reading preserves sparse counts, all selected passages, hypotheses, warnings and canonical source identity', () => {
  for (const mode of ['normal','sparse','conflict'] as const) {
    const context = syntheticWorkshopContext('cedar',mode);
    const record = createGenerationRecord(createC3ModelRequest(context,request),syntheticMeetingCandidate(context),context);
    const reading = generatedReading(record,context,'synthetic');
    const output = formatBriefExport(reading);
    assert.equal(reading.facts.length,record.draft!.selectedEvidenceRefs.length);
    assert.match(output,/Synthetic example/);
    assert.doesNotMatch(output,/direct_support|cautious_inference|evidence_[a-f0-9]+/);
    for (const warning of record.draft!.warnings) assert.ok(output.includes(warning.message));
    for (const risk of record.draft!.risksUnknowns) assert.ok(output.includes(risk.text));
    if(mode==='sparse') { assert.equal(reading.sourceCount,0); assert.match(output,/No evidence selected/); }
    if(mode==='conflict') assert.match(output,/funding status differs/);
  }
  const record = createGenerationRecord(createC3ModelRequest(ctx,request),syntheticMeetingCandidate(ctx),ctx);
  const sources = ctx.context.admittedSources;
  const duplicateUrlContext = {...ctx, context:{...ctx.context,admittedSources:sources.map(source=>({...source,canonicalUrl:sources[0]!.canonicalUrl}))}};
  assert.equal(generatedReading(record,duplicateUrlContext).sourceCount,1);
});

test('new surfaces bind export and edits to the displayed work; no-change and clear do not rewrite raw history', async () => {
  const server = await startC3Server({context:ctx,provider,listen:false});
  try {
    const b = await browser(server);
    const generation = (await b.call('/api/generate',envelope())).json();
    const initial = (await b.call('/api/work-state',{})).json();
    const copy = authoredPayload(generation.recordId);
    const kept = (await b.call('/api/authored-copy',{recordId:generation.recordId,workVersion:initial.workVersion,copy})).json();
    assert.equal((await b.call('/api/brief-export',{recordId:generation.recordId,workVersion:initial.workVersion})).status,409);
    assert.equal((await b.call('/api/brief-export',{recordId:generation.recordId})).status,409);
    assert.equal((await b.call('/api/authored-copy',{recordId:generation.recordId,workVersion:initial.workVersion,copy:{...copy,title:'Stale tab'}})).status,409);
    const noChange = (await b.call('/api/authored-copy',{recordId:generation.recordId,workVersion:kept.workVersion,copy})).json();
    assert.equal(noChange.noChange,true);
    assert.equal((await b.call('/api/work-state',{})).json().workVersion,kept.workVersion);
    assert.equal((await b.call('/api/authored-copy',{recordId:generation.recordId,workVersion:kept.workVersion,copy:null})).status,200);
    const state = (await b.call('/api/work-state',{})).json();
    const output = (await b.call('/api/brief-export',{recordId:generation.recordId,workVersion:state.workVersion})).json();
    assert.equal(output.mode,'generated-record');
    assert.equal(state.recordId,generation.recordId);
  } finally {await server.close();}
});

test('source link rendering escapes hostile labels and refuses executable URLs', async () => {
  const {renderBriefReading} = await import('../../src/c3/brief-first.ts');
  const record=createGenerationRecord(createC3ModelRequest(ctx,request),syntheticMeetingCandidate(ctx),ctx);
  const reading={...generatedReading(record,ctx),sourceTitles:['<img src=x onerror=alert(1)>'],sourceUrls:['javascript:alert(1)'],sourceDates:['unknown']};
  const html=renderBriefReading(reading,record,ctx,{hasAuthoredEditor:true});
  assert.doesNotMatch(html,/href="javascript:|<img/);
  assert.match(html,/&lt;img/);
});

test('Apply preserves previous authored text for explicit rebind; Save and reopen retain it beside unchanged history',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c3-authored-revision-'));
  const revisionProvider={...provider,async generate(model:C3ModelRequest){return syntheticMeetingCandidate(ctx,Boolean(model.revision));}};
  const options={context:ctx,provider:revisionProvider,listen:false,workStore:{root,principal:'operator-one'}};
  const server=await startC3Server(options);
  try{
    const b=await browser(server);const first=(await b.call('/api/generate',envelope())).json();await b.call('/?brief=1');
    const initial=(await b.call('/api/work-state',{})).json();const authored=authoredPayload(first.recordId);
    assert.equal((await b.call('/api/authored-copy',{recordId:first.recordId,workVersion:initial.workVersion,copy:authored})).status,200);
    const stage=(await b.call('/api/revise',{recordId:first.recordId,note:'Improve the close.',priorNote:''})).json();
    const proposal=(await b.call('/api/generate',{...envelope(),recordId:first.recordId,pendingRevisionToken:stage.pendingRevisionToken})).json();
    assert.equal(proposal.proposalReady,true);
    const applied=await b.call('/api/apply-revision',{recordId:first.recordId,proposalId:proposal.proposalId,instruction:'Improve the close.',pendingRevisionToken:stage.pendingRevisionToken});assert.equal(applied.status,200,applied.text);assert.equal(applied.json().authoredCopyNeedsReview,true);
    const page=await b.call('/?brief=1');assert.match(page.text,/previous authored text is retained/);assert.match(page.text,/Discovery: research enablement/);assert.match(page.text,/data-brief-mode="generated-record"/);
    const current=(await b.call('/api/work-state',{})).json();const saved=await b.call('/api/save',{recordId:current.recordId,documentId:current.documentId,expectedVersion:current.version,workVersion:current.workVersion});assert.equal(saved.status,200,saved.text);
    assert.equal(saved.json().authoredCopy.priorRecordId,first.recordId);
    assert.equal((await b.call('/api/reopen',{documentId:current.documentId})).status,200);
    assert.match((await b.call('/?brief=1')).text,/previous authored text is retained/);
    const kept=await b.call('/api/authored-copy',{recordId:current.recordId,workVersion:current.workVersion,copy:{...authored,priorRecordId:current.recordId}});assert.equal(kept.status,200);
    assert.match((await b.call('/?brief=1')).text,/data-brief-mode="user-authored"/);
  }finally{await server.close();await rm(root,{recursive:true,force:true});}
});

test('reopened brief reading and export use saved historical context after the account becomes sparse',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c3-brief-context-'));
  const options={context:ctx,provider,listen:false,workStore:{root,principal:'operator-one'}};
  let server=await startC3Server(options);
  try{
    const b=await browser(server);const first=(await b.call('/api/generate',envelope())).json();await b.call('/?brief=1');const s=(await b.call('/api/work-state',{})).json();
    const saved=await b.call('/api/save',{recordId:first.recordId,documentId:s.documentId,expectedVersion:0,workVersion:s.workVersion});assert.equal(saved.status,200);
    await server.close();server=await startC3Server({...options,context:syntheticWorkshopContext('harbor','sparse')});
    const reopened=await browser(server);assert.equal((await reopened.call('/api/reopen',{documentId:s.documentId})).status,200);
    const page=await reopened.call('/?brief=1');assert.equal(page.status,200);assert.ok(page.text.includes(`name="c3-context" content="${ctx.sha256}"`));assert.match(page.text,/1 selected passage from 1 source/);
    const state=(await reopened.call('/api/work-state',{})).json();const exported=(await reopened.call('/api/brief-export',{recordId:state.recordId,workVersion:state.workVersion})).json();assert.match(exported.exportText,/1 selected passage from 1 source/);
    const source=ctx.context.admittedSources[0]!;assert.ok(exported.exportText.includes(source.canonicalUrl));assert.ok(exported.exportText.includes(source.excerpts[0]!.exactExcerpt));
  }finally{await server.close();await rm(root,{recursive:true,force:true});}
});
