import assert from 'node:assert/strict';
import test from 'node:test';
import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtemp, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson } from '../../src/c3/context.ts';
import { LocalWorkStore } from '../../src/c3/work-store.ts';
import { C3CommandResponseError } from '../../src/c3/provider.ts';
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord, type C3GenerationRecord, type C3ModelRequest } from '../../src/c3/generation-contract.ts';
import { syntheticMeetingRequest as request, syntheticMeetingCandidate, syntheticWorkshopContext } from '../fixtures/c3-workshop.ts';
import { scriptedFullCoverage } from './c3-generation-scripted.ts';
import { browser, startFixture, fixtureProvider, originalContext, refreshedContext, originReceipt, memoryOnly } from './c3-historical-service-helper.ts';

const envelope = (recordId: string | null = null, pendingRevisionToken: string | null = null, meeting = request) =>
  ({ operationId: randomBytes(24).toString('base64url'), recordId, pendingRevisionToken, request: meeting });
type Browser = Awaited<ReturnType<typeof browser>>;
async function state(b: Browser) { return (await b.call('/api/work-state', {})).json(); }
async function save(b: Browser, copy = false) {
  const s = await state(b);
  const result = await b.call(copy ? '/api/save-copy' : '/api/save', { recordId: s.recordId, documentId: s.documentId, expectedVersion: s.version, workVersion: s.workVersion });
  assert.equal(result.status, 200, result.text); return result.json();
}
async function seed(root: string) {
  const server = await startFixture(root, { context: originalContext });
  try {
    const b = await browser(server); const generated = await b.call('/api/generate', envelope());
    assert.equal(generated.status, 200, generated.text); return await save(b);
  } finally { await server.close(); }
}
const store = (root: string) => new LocalWorkStore({ root, principal: 'synthetic-http-operator', originReceipt }, refreshedContext);
function originalEvidence(html: string) {
  const excerpt = originalContext.context.admittedSources[0]!.excerpts[0]!;
  const escaped = excerpt.exactExcerpt.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  assert.ok(html.includes(`<blockquote>${escaped}</blockquote>`), 'original selected excerpt remains inspectable');
  assert.match(html, /<details id="evidence-1"><summary>Evidence 1/);
  assert.match(html, /<div data-evidence-content>/);
}

test('HTTP graceful restart: historical evidence, notes, Save/copy, proposal/Apply and fresh replacement keep exact contexts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-historical-http-'));
  let running: Awaited<ReturnType<typeof startFixture>> | undefined;
  try {
    const saved = await seed(root);
    const originalFile = join(root, (await readdir(root)).find(name => name.endsWith('.json'))!);
    const originalBytes = await readFile(originalFile);
    const originalRecord = store(root).load(saved.documentId).work.record;
    const requests: C3ModelRequest[] = [];
    const provider = fixtureProvider();
    running = await startFixture(root, { provider: { ...provider, async generate(model, signal) { requests.push(model); return provider.generate(model, signal); } } });
    let b = await browser(running);
    assert.ok((await b.call('/?view=workshop')).text.includes(`data-reopen-work="${saved.documentId}"`));
    assert.equal((await b.call('/api/reopen', { documentId: saved.documentId })).status, 200);
    originalEvidence((await b.call('/?draft=1')).text);
    for (const route of ['/', '/?view=research', '/?kind=strategy', '/?prepare=1']) {
      const page = await b.call(route); assert.equal(page.status, 200);
      assert.ok(!page.text.includes(originalContext.context.admittedSources[0]!.excerpts[0]!.exactExcerpt), `${route} uses refreshed context`);
    }
    assert.equal((await b.call('/api/note', { recordId: saved.recordId, note: 'Synthetic retained note', priorNote: '' })).status, 200);
    assert.equal((await b.call('/api/section-note', { recordId: saved.recordId, section: 'Opening', text: 'Synthetic section note', priorText: '' })).status, 200);
    await save(b); const copy = await save(b, true); assert.notEqual(copy.documentId, saved.documentId);
    assert.equal(store(root).loadWithContext(copy.documentId).context.canonicalJson, originalContext.canonicalJson);
    const correction = 'Focus the close on a follow-up owner.';
    const staged = (await b.call('/api/revise', { recordId: saved.recordId, note: correction, priorNote: 'Synthetic retained note' })).json();
    const proposedResponse = await b.call('/api/generate', envelope(saved.recordId, staged.pendingRevisionToken));
    assert.equal(proposedResponse.status, 200, proposedResponse.text); const proposed = proposedResponse.json();
    assert.equal(proposed.proposalReady, true); assert.equal((await state(b)).recordId, saved.recordId);
    assert.equal(requests[0]!.contextSha256, originalContext.sha256);
    assert.equal(requests[0]!.revision!.priorRawResponse, originalRecord.rawResponse);
    originalEvidence(proposed.html);
    await save(b);
    const storedProposal = store(root).load(copy.documentId).work;
    assert.equal(canonicalJson(storedProposal.record), canonicalJson(originalRecord));
    assert.equal(storedProposal.proposal!.contextSha256, originalContext.sha256);
    assert.equal(storedProposal.proposal!.rawResponse, syntheticMeetingCandidate(originalContext, true) + '\n\n');
    await running.close(); running = await startFixture(root); b = await browser(running);
    assert.equal((await b.call('/api/reopen', { documentId: copy.documentId })).status, 200);
    originalEvidence((await b.call('/?draft=1')).text);
    const applied = await b.call('/api/apply-revision', { recordId: saved.recordId, proposalId: proposed.proposalId, pendingRevisionToken: staged.pendingRevisionToken, instruction: correction });
    assert.equal(applied.status, 200, applied.text); originalEvidence(applied.json().html);
    await save(b);
    const history = store(root).loadWithContext(copy.documentId);
    assert.equal(history.context.sha256, originalContext.sha256);
    assert.equal(canonicalJson(history.saved.work.records[0]), canonicalJson(originalRecord));
    assert.equal(history.saved.work.correctionNote, 'Synthetic retained note');
    assert.equal(history.saved.work.sectionNotes.Opening, 'Synthetic section note');
    const fresh = await b.call('/api/generate', envelope(proposed.proposalId, null, { ...request, audience: 'New synthetic audience' }));
    assert.equal(fresh.status, 200, fresh.text); const freshSaved = await save(b);
    assert.notEqual(freshSaved.documentId, copy.documentId);
    assert.equal(store(root).loadWithContext(freshSaved.documentId).context.sha256, refreshedContext.sha256);
    assert.deepEqual(await readFile(originalFile), originalBytes);
  } finally { await running?.close(); await rm(root, { recursive: true, force: true }); }
});

for (const phase of ['revision', 'replacement'] as const) for (const mode of ['no-change', 'failure', 'cancel', 'structural', 'verifier_format', 'semantic_refusal', 'verifier_transport', 'generator_transport'] as const) {
  if (phase === 'replacement' && mode === 'no-change') continue;
  test(`HTTP historical preservation and classified notice: ${phase} ${mode}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'c3-historical-preserve-'));
    let running: Awaited<ReturnType<typeof startFixture>> | undefined;
    try {
      const saved = await seed(root); const records: C3GenerationRecord[] = [];
      let started!: () => void; const entered = new Promise<void>(resolve => { started = resolve; });
      let calls = 0;
      const attemptContext = phase === 'revision' ? originalContext : refreshedContext;
      const raw = syntheticMeetingCandidate(attemptContext, phase === 'revision') + '\n\n';
      running = await startFixture(root, { provider: { name: 'synthetic-failure-fixture', executionMode: 'local',
        async generate(model, signal) {
          calls++; assert.equal(model.contextSha256, attemptContext.sha256); started();
          if (mode === 'failure') throw Error('Synthetic adapter precondition failure');
          if (mode === 'generator_transport') throw new C3CommandResponseError('Synthetic generator stream failed', { kind: 'atliera.c3.transport-failure', rawResponseBase64: '', receivedBytes: 0, retainedBytes: 0, truncated: false, completion: 'failed', message: 'Synthetic fixture' });
          if (mode === 'cancel') return new Promise<string>((_resolve, reject) => { signal.addEventListener('abort', () => reject(Error('Synthetic cancellation')), { once: true }); });
          return mode === 'structural' ? '{synthetic invalid JSON\n' : raw;
        }, async verify(check) {
          if (mode === 'verifier_transport') throw Error('Synthetic verifier unavailable');
          if (mode === 'verifier_format') return '{invalid verifier fixture';
          const result = JSON.parse(scriptedFullCoverage(check));
          if (mode === 'semantic_refusal') result.findings[0].verdict = 'insufficient';
          return JSON.stringify(result);
        } }, generationAudit: { async retainCandidate() {}, async retainFailure() {}, async retainRecord(record) { records.push(record); } } });
      const b = await browser(running); assert.equal((await b.call('/api/reopen', { documentId: saved.documentId })).status, 200);
      assert.equal((await b.call('/api/note', { recordId: saved.recordId, note: 'Keep this synthetic note', priorNote: '' })).status, 200);
      if (mode === 'no-change') {
        const unchanged = await b.call('/api/generate', envelope(saved.recordId)); assert.equal(unchanged.json().noChange, true);
        assert.equal((await b.call('/api/revise', { recordId: saved.recordId, note: '', priorNote: 'Keep this synthetic note' })).json().noChange, true);
        assert.equal(calls, 0); originalEvidence(unchanged.json().html);
      } else {
        const stage = phase === 'revision' ? (await b.call('/api/revise', { recordId: saved.recordId, note: 'Revise the synthetic close.', priorNote: 'Keep this synthetic note' })).json() : undefined;
        const op = envelope(saved.recordId, stage?.pendingRevisionToken ?? null, phase === 'revision' ? request : { ...request, audience: 'New synthetic audience' });
        const pending = b.call('/api/generate', op);
        if (mode === 'cancel') { await entered; assert.equal((await b.call('/api/cancel', op)).status, 200); }
        const result = await pending; const payload = result.json();
        if (mode === 'cancel') assert.equal(payload.outcome, 'cancelled');
        else if (mode === 'failure' || mode === 'generator_transport') {
          assert.equal(result.status, 502); assert.equal(payload.outcome, 'failed');
          assert.equal(payload.failureKind, mode === 'generator_transport' ? mode : undefined);
          assert.ok(!payload.refusal); if (mode === 'generator_transport') assert.match(payload.html, /Generator transport failure/);
        } else {
          assert.equal(result.status, 422, result.text); assert.equal(payload.failureKind, mode); assert.equal(payload.refusal.failureKind, mode);
          const labels = { structural: 'Draft format rejected', verifier_format: 'Evidence-check format rejected', semantic_refusal: 'Evidence check refused this proposal', verifier_transport: 'Evidence-check transport failed' };
          assert.ok(payload.html.includes(labels[mode as keyof typeof labels]));
          assert.ok(payload.html.includes('Original retained without repair')); assert.equal(records[0]!.rawResponse, mode === 'structural' ? '{synthetic invalid JSON\n' : raw);
        }
      }
      originalEvidence((await b.call('/?draft=1')).text);
      const after = await state(b); assert.equal(after.recordId, saved.recordId); assert.equal(after.snapshot.correctionNote, 'Keep this synthetic note');
      await save(b); const copy = await save(b, true);
      assert.equal(store(root).loadWithContext(copy.documentId).context.canonicalJson, originalContext.canonicalJson);
      assert.equal(store(root).load(copy.documentId).work.record.recordId, saved.recordId);
    } finally { await running?.close(); await rm(root, { recursive: true, force: true }); }
  });
}

test('HTTP current runtime hold prevents old-context revision generation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-historical-hold-')); let running: Awaited<ReturnType<typeof startFixture>> | undefined;
  try {
    const saved = await seed(root);
    const context = { ...refreshedContext.context, ownerCorrections: [{ kind: 'content_caveat' as const, text: 'Synthetic generation not enabled', recordedState: 'effective_owner_disposition' as const, authorizesApprovalOrPersistence: false as const, derivedInterpretation: true as const, sourceOwnerDecisionRawSha256: refreshedContext.context.ownerDecisionSource!.rawSha256 }] };
    const bytes = canonicalJson(context); let calls = 0;
    running = await startFixture(root, { context: { context, canonicalJson: bytes, sha256: createHash('sha256').update(bytes).digest('hex') }, provider: { ...fixtureProvider(), async generate() { calls++; throw Error('Must not dispatch'); } } });
    const b = await browser(running); assert.equal((await b.call('/api/reopen', { documentId: saved.documentId })).status, 200);
    const staged = (await b.call('/api/revise', { recordId: saved.recordId, note: 'Revise the synthetic close.', priorNote: '' })).json();
    const result = await b.call('/api/generate', envelope(saved.recordId, staged.pendingRevisionToken));
    assert.equal(result.status, 409); assert.match(result.json().error, /held/); assert.equal(calls, 0);
    originalEvidence((await b.call('/?draft=1')).text); await save(b);
  } finally { await running?.close(); await rm(root, { recursive: true, force: true }); }
});

test('HTTP unreadable latest record preserves valid list; account/operator/record mismatch is refused', async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-historical-identity-')); let running: Awaited<ReturnType<typeof startFixture>> | undefined;
  try {
    const good = await seed(root); const bad = await seed(root);
    const file = (await readdir(root)).find(name => name.includes(bad.documentId))!;
    await writeFile(join(root, file), '{private parser detail SENTINEL\n');
    running = await startFixture(root); let b = await browser(running);
    const listing = await b.call('/?view=workshop'); assert.ok(listing.text.includes(`data-reopen-work="${good.documentId}"`));
    assert.match(listing.text, /Some saved briefs are unavailable/); assert.ok(!listing.text.includes(`data-reopen-work="${bad.documentId}"`));
    assert.ok(!listing.text.includes(root)); assert.doesNotMatch(listing.text, /SENTINEL|synthetic-http-operator/);
    assert.equal((await b.call('/api/reopen', { documentId: good.documentId })).status, 200);
    assert.equal((await b.call('/api/reopen', { documentId: bad.documentId })).status, 409);
    assert.equal((await b.call('/api/revise', { recordId: 'c3_' + '0'.repeat(24), note: 'Synthetic wrong identity', priorNote: '' })).status, 409);
    originalEvidence((await b.call('/?draft=1')).text);
    await running.close(); running = await startFixture(root, { workStore: { root, principal: 'different-synthetic-operator' } }); b = await browser(running);
    assert.equal((await b.call('/api/reopen', { documentId: good.documentId })).status, 409);
    await running.close(); running = await startFixture(root, { context: syntheticWorkshopContext('cedar') }); b = await browser(running);
    assert.equal((await b.call('/api/reopen', { documentId: good.documentId })).status, 409);
  } finally { await running?.close(); await rm(root, { recursive: true, force: true }); }
});

test('HTTP historical context cannot borrow a different admitted replay pair', async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-historical-pair-')); let running: Awaited<ReturnType<typeof startFixture>> | undefined;
  try {
    const saved = await seed(root);
    const prior = createGenerationRecord(createC3ModelRequest(refreshedContext, request, null, '5'), syntheticMeetingCandidate(refreshedContext), refreshedContext);
    const correction = 'Use the exact synthetic revision.';
    const revision = createGenerationRecord(createC3ModelRequest(refreshedContext, request, createC3RevisionContext(prior, correction, 1), '5'), syntheticMeetingCandidate(refreshedContext, true), refreshedContext);
    assert.equal(prior.outcome, 'succeeded'); assert.equal(revision.outcome, 'succeeded');
    let calls = 0;
    running = await startFixture(root, { syntheticPreview: true,
      recordedReplay: { initialRequest: request, correctionNote: correction, priorRecord: prior, revisionRecord: revision },
      provider: { name: 'recorded-replay', executionMode: 'local', async generate() { calls++; throw Error('Unrelated pair must not dispatch'); } } });
    const b = await browser(running); assert.equal((await b.call('/api/reopen', { documentId: saved.documentId })).status, 200);
    const result = await b.call('/api/revise', { recordId: saved.recordId, note: correction, priorNote: '' });
    assert.equal(result.status, 409); assert.match(result.json().error, /no recorded response/); assert.equal(calls, 0);
    originalEvidence((await b.call('/?draft=1')).text); await save(b);
    assert.equal(store(root).loadWithContext(saved.documentId).context.sha256, originalContext.sha256);
  } finally { await running?.close(); await rm(root, { recursive: true, force: true }); }
});

async function childServer(root: string, context: 'old' | 'refreshed') {
  const child = fork(new URL('./c3-historical-service-helper.ts', import.meta.url), ['--serve-historical-fixture', root, context], { execArgv: ['--import', 'tsx'], stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  try {
  const ready = await new Promise<{ origin: string }>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Owned HTTP fixture child readiness timed out')); }, 10_000);
    child.once('message', (message: any) => { clearTimeout(timer); if (message.error) reject(Error(message.error)); else resolve(message); });
    child.once('exit', () => { clearTimeout(timer); reject(Error('Owned HTTP fixture child exited before readiness')); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  return { child, ...ready };
  } catch (error) { await killOwned(child); throw error; }
}
async function killOwned(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
}
test('real HTTP process restart: SIGKILL owned saved-service child and reopen exact original context in refreshed child', { skip: memoryOnly ? 'Real sockets unavailable: in-process fallback does not claim process restart coverage' : false }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'c3-historical-process-')); let child: ChildProcess | undefined;
  try {
    const first = await childServer(root, 'old'); child = first.child;
    const a = await browser(first); assert.equal((await a.call('/api/generate', envelope())).status, 200); const saved = await save(a);
    const file = join(root, (await readdir(root)).find(name => name.endsWith('.json'))!); const before = await readFile(file);
    await killOwned(child);
    const restarted = await childServer(root, 'refreshed'); child = restarted.child;
    const b = await browser(restarted); assert.ok((await b.call('/?view=workshop')).text.includes(saved.documentId));
    assert.equal((await b.call('/api/reopen', { documentId: saved.documentId })).status, 200); originalEvidence((await b.call('/?draft=1')).text);
    assert.equal((await state(b)).recordId, saved.recordId); assert.deepEqual(await readFile(file), before);
  } finally { await killOwned(child); await rm(root, { recursive: true, force: true }); }
});
