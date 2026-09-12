import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { startC3Server, type C3ServerOptions, type RunningC3Server } from '../../src/c3/service.ts';
import { contextFor } from '../../src/c3/cli.ts';
import { renderC3Page, C3_CLIENT_SCRIPT } from '../../src/c3/render.ts';
import { accountPath } from '../../src/c3/workspace-route.ts';
import { DisabledC3ModelProvider } from '../../src/c3/provider.ts';
import { createC3ModelRequest, createC3RevisionContext, createGenerationRecord } from '../../src/c3/generation-contract.ts';
import { syntheticWorkshopContext, syntheticMeetingRequest as request, syntheticMeetingCandidate } from '../fixtures/c3-workshop.ts';

// Set C3_TEST_REAL_HTTP=1 on a host with socket permission to run the SAME assertions over TCP.
// Default uses the real production request handler and stream bodies, without claiming socket coverage.
const realHttp = process.env.C3_TEST_REAL_HTTP === '1';
const start = (options: C3ServerOptions) => startC3Server({...options, listen:realHttp});
class Response extends EventEmitter {
  status = 200; headers: Record<string,string> = {}; text = ''; writableEnded = false;
  done: Promise<void>; finish!: () => void;
  constructor() { super(); this.done = new Promise(resolve => { this.finish = resolve; }); }
  setHeader(k:string,v:string) { this.headers[k] = v; }
  writeHead(s:number,h:Record<string,string>) { this.status=s; Object.assign(this.headers,h); }
  end(s = '') { this.text=s; this.writableEnded=true; this.finish(); }
}
function browser(server: RunningC3Server) {
  const cookies = new Map<string,string>();
  const identities = new Map<string,{csrf:string;documentId:string}>();
  const call = async (accountId:string, route:string, body?:unknown, overrides:Record<string,string>={}) => {
    const path = accountId ? accountPath(accountId) + route : route;
    const identity = identities.get(accountId);
    const headers = {host:new URL(server.origin).host, cookie:[...cookies.values()].join('; '), origin:server.origin,
      'content-type':'application/json', 'x-c3-account':accountId, 'x-c3-csrf':identity?.csrf ?? '',
      'x-c3-document':identity?.documentId ?? '', ...overrides};
    let status:number, text:string, responseHeaders:Record<string,string>;
    if (realHttp) {
      const response = await fetch(server.origin + path, {method:body === undefined ? 'GET':'POST', headers,
        body:body === undefined ? undefined:JSON.stringify(body), redirect:'manual'});
      status=response.status; text=await response.text(); responseHeaders=Object.fromEntries(response.headers.entries());
    } else {
      const req = new PassThrough() as unknown as IncomingMessage;
      Object.assign(req,{method:body === undefined?'GET':'POST',url:path,headers});
      const response=new Response(); server.server.emit('request',req,response as unknown as ServerResponse);
      (req as unknown as PassThrough).end(body === undefined ? undefined:JSON.stringify(body)); await response.done;
      status=response.status; text=response.text; responseHeaders=response.headers;
    }
    const cookie=responseHeaders['set-cookie']?.split(';')[0];
    if(cookie) cookies.set(cookie.split('=')[0]!,cookie);
    if(status<300) {
      const payload=body === undefined ? undefined:JSON.parse(text);
      const page=payload?.html ?? text;
      const csrf=/name="c3-csrf" content="([^"]+)"/u.exec(page)?.[1];
      const documentId=payload?.documentId ?? /name="c3-document" content="([^"]+)"/u.exec(page)?.[1];
      if(csrf) identities.set(accountId,{csrf,documentId:documentId ?? ''});
      else if(documentId && identity) identity.documentId=documentId;
    }
    return {status,text,headers:responseHeaders,json:()=>JSON.parse(text)};
  };
  return {call, identities};
}
let sequence=0;
const envelope = (recordId:string|null=null,pendingRevisionToken:string|null=null) =>
  ({request, recordId,pendingRevisionToken,operationId:String(++sequence).padStart(32,'b')});
function syntheticAccount(name:'harbor'|'cedar') {
  const context=syntheticWorkshopContext(name);
  const prior=createGenerationRecord(createC3ModelRequest(context,request,undefined,'5'),syntheticMeetingCandidate(context),context);
  const correctionNote='Use the authored revised opening.';
  const revision=createGenerationRecord(createC3ModelRequest(context,request,createC3RevisionContext(prior,correctionNote,1),'5'),syntheticMeetingCandidate(context,true),context);
  assert.equal(prior.outcome,'succeeded'); assert.equal(revision.outcome,'succeeded');
  return {context, syntheticPreview:true, provider:{name:'synthetic-authored-preview',executionMode:'local' as const,
    async generate(model:ReturnType<typeof createC3ModelRequest>) {return model.revision ? revision.rawResponse:prior.rawResponse;}},
    recordedReplay:{initialRequest:request,correctionNote,priorRecord:prior,revisionRecord:revision}};
}

test('retained Utah/FedEx routes, source coverage, hold, native URLs and honest empty libraries',async t=>{
  t.diagnostic(realHttp ? 'Real TCP HTTP transport' : 'Production HTTP handler seam; sockets not exercised');
  const [utah,fedex]=await Promise.all([contextFor('acc_university_of_utah'),contextFor('acc_fedex_corp')]);
  assert.equal(utah.context.admittedSources.length,10); assert.equal(fedex.context.admittedSources.length,9);
  const originals=[utah.canonicalJson,fedex.canonicalJson];
  const root=await mkdtemp(join(tmpdir(),'c3-multi-retained-'));
  const workStore={root,principal:'disposable-b1-operator'};
  const provider=new DisabledC3ModelProvider();
  const server=await start({context:utah,provider,workStore,accounts:[{context:fedex,provider,workStore}]});
  try {
    const b=browser(server);
    const art = await b.call('', '/assets/campus-concept.png');
    assert.equal(art.status, 200);
    assert.equal(art.headers['content-type'], 'image/png');
    assert.equal(art.headers['x-content-type-options'], 'nosniff');
    if (!realHttp) assert.deepEqual(Buffer.from(art.text), await readFile('src/c3/assets/campus-concept.png'));
    for (const path of ['/assets/missing.png', '/assets/campus-concept.png?path=other', '/assets/../service.ts']) {
      assert.notEqual((await b.call('', path)).status, 200, 'No generic asset/filesystem route');
    }
    const legacy=await b.call('','/?prepare=1');assert.equal(legacy.status,302);assert.equal(legacy.headers.location,accountPath(utah.context.account.accountId)+'/?prepare=1');
    for(const context of [utah,fedex]) {
      const id=context.context.account.accountId;
      for(const route of ['/','/?view=research&topic=sources','/?view=workshop','/?prepare=1']) {
        const page=await b.call(id,route);assert.equal(page.status,200);
        assert.ok(page.text.includes(`name="c3-account" content="${id}"`));
        assert.match(page.text,/Switch account/);
        const markup=page.text.split('<script>')[0]!;
        assert.doesNotMatch(markup,/(?:href|value)="\/(?:\?|"|account")/u);
        assert.ok(markup.includes(`href="${accountPath(id)}/?view=workshop"`));
      }
      const research=(await b.call(id,'/?view=research&topic=sources')).text;
      for(const source of context.context.admittedSources) assert.ok(research.includes(`data-source-id="${source.sourceId}"`));
      const other=context===utah?fedex:utah;
      for(const source of other.context.admittedSources) assert.ok(!research.includes(`data-source-id="${source.sourceId}"`));
      assert.match((await b.call(id,'/?view=workshop')).text,/No saved briefs/u);
      assert.equal((await b.call(id,'/?view=research&topic=sources&sourceId='+other.context.admittedSources[0]!.sourceId)).status,400);
    }
    const fedexId=fedex.context.account.accountId;
    assert.match((await b.call(fedexId,'/?prepare=1')).text,/held pending the recorded C2 revision/u);
    assert.equal((await b.call(fedexId,'/api/generate',envelope())).status,409);
    assert.equal((await b.call(fedexId,'/?view=research&reading=redtail-access')).status,404);
    assert.equal((await b.call('acc_unknown','/')).status,404);
    assert.equal((await b.call(fedexId,'/?view=research&view=workshop')).status,400);
    assert.equal(server.status().generationAttempted,0);
    assert.equal((await readdir(root)).length,0,'No retained documents fabricated');
    assert.deepEqual([utah.canonicalJson,fedex.canonicalJson],originals);
  } finally {await server.close();await rm(root,{recursive:true,force:true});}
});

test('account sessions retain notes and proposals; cross-account actions, stale identities and other browser fail closed',async()=>{
  const root=await mkdtemp(join(tmpdir(),'c3-multi-work-'));
  const workStore={root,principal:'disposable-b1-operator'};
  const a=syntheticAccount('harbor'), z=syntheticAccount('cedar');
  const aid=a.context.context.account.accountId,zid=z.context.context.account.accountId;
  const server=await start({...a,workStore,accounts:[{...z,workStore}]});
  try {
    const b=browser(server), other=browser(server);
    await b.call(aid,'/'); await other.call(aid,'/');
    const initial=(await b.call(aid,'/api/generate',envelope())).json();
    const recordId=initial.recordId;
    assert.equal(initial.location,accountPath(aid)+'/?draft=1');
    const wrongEvidence=z.context.context.admittedSources[0]!.excerpts[0]!.evidenceId;
    assert.equal((await b.call(aid,'/api/planning/next-steps',{version:0,proposedNextStep:{concern:'Concern',action:'Action',owner:'',targetDate:'',questionOrBlocker:'',evidenceIds:[wrongEvidence]}})).status,409);
    assert.equal((await b.call(aid,'/api/note',{recordId,note:'Unsaved Harbor note <script>not code</script>',priorNote:''})).status,200);
    assert.equal((await b.call(aid,'/api/section-note',{recordId,section:'Opening',text:'Harbor section note',priorText:''})).status,200);
    const stage=(await b.call(aid,'/api/revise',{recordId,note:a.recordedReplay.correctionNote,priorNote:'Unsaved Harbor note <script>not code</script>'})).json();
    const proposed=(await b.call(aid,'/api/generate',envelope(recordId,stage.pendingRevisionToken))).json();
    assert.equal(proposed.proposalReady,true);
    const before=(await b.call(aid,'/api/work-state',{})).json();
    await b.call(zid,'/');
    const foreign={...b.identities.get(aid)!};
    for(const route of ['/api/note','/api/section-note','/api/apply-revision','/api/save','/api/reopen','/api/generate','/api/work-state']) {
      assert.equal((await b.call(zid,route,{recordId},{'x-c3-csrf':foreign.csrf,'x-c3-account':aid,'x-c3-document':foreign.documentId})).status,403,route);
    }
    const save={recordId,documentId:before.documentId,expectedVersion:0,workVersion:before.workVersion};
    for(const [route,body] of [
      ['/api/note',{recordId,note:'wrong',priorNote:''}],
      ['/api/section-note',{recordId,section:'Opening',text:'wrong',priorText:''}],
      ['/api/apply-revision',{recordId,proposalId:proposed.proposalId,pendingRevisionToken:stage.pendingRevisionToken,instruction:a.recordedReplay.correctionNote}],
      ['/api/save',save],['/api/reopen',{documentId:before.documentId}],
    ] as const) assert.equal((await b.call(zid,route,body)).status,409,route);
    assert.equal((await other.call(aid,'/api/note',{recordId,note:'wrong session',priorNote:''})).status,409);
    assert.equal((await other.call(aid,'/api/work-state',{})).json().recordId,null);
    assert.equal((await b.call(zid,'/api/work-state',{})).json().recordId,null);
    const restored=await b.call(aid,'/?draft=1');
    assert.match(restored.text,/Unsaved Harbor note &lt;script&gt;not code&lt;\/script&gt;/u);
    assert.match(restored.text,/Harbor section note/u);
    assert.deepEqual((await b.call(aid,'/api/work-state',{})).json(),before);
    assert.equal((await b.call(aid,'/api/save',save,{'origin':'http://wrong.example'})).status,403);
    assert.equal((await b.call(aid,'/api/save',save,{'x-c3-document':'doc_'+'0'.repeat(24)})).status,409);
    assert.equal((await b.call(aid,'/api/save',save)).status,200);
    const name=(await readdir(root)).find(name=>name.endsWith('.json'))!;
    const originalBytes=await readFile(join(root,name));
    assert.match((await b.call(aid,'/?view=workshop')).text,new RegExp(before.documentId));
    const home = (await b.call(aid,'/')).text;
    assert.match(home, /Saved briefs/);
    assert.ok(!home.includes('No saved briefs for this account.'));
    assert.ok(!(await b.call(zid,'/')).text.includes(`data-reopen-work="${before.documentId}"`));
    assert.deepEqual(await readFile(join(root,name)),originalBytes, 'Overview listing is read-only');
    assert.ok(!(await b.call(zid,'/?view=workshop')).text.includes(`data-reopen-work="${before.documentId}"`));
    // A matching document ID in another account's request does not open a hidden row.
    assert.equal((await b.call(zid,'/api/reopen',{documentId:before.documentId})).status,409);
    assert.deepEqual(await readFile(join(root,name)),originalBytes);
    const partition=await start({...a,workStore:{root,principal:'different-b1-operator'},accounts:[z]});
    try {
      const stranger=browser(partition);await stranger.call(aid,'/');
      assert.equal((await stranger.call(aid,'/api/reopen',{documentId:before.documentId})).status,409);
      assert.ok(!(await stranger.call(aid,'/?view=workshop')).text.includes(`data-reopen-work="${before.documentId}"`));
    } finally {await partition.close();}

    const saved=JSON.parse(originalBytes.toString());
    assert.equal(saved.work.record.rawResponse,a.recordedReplay.priorRecord.rawResponse);
    assert.equal(saved.work.proposal.rawResponse,a.recordedReplay.revisionRecord.rawResponse);
    // Copying the record under the other account's namespace still fails content ownership validation.
    const cedar=(await b.call(zid,'/api/generate',envelope())).json();
    const cs=(await b.call(zid,'/api/work-state',{})).json();
    assert.equal((await b.call(zid,'/api/save',{recordId:cedar.recordId,documentId:cs.documentId,expectedVersion:0,workVersion:cs.workVersion})).status,200);
    const cedarName=(await readdir(root)).find(n=>n.endsWith('.json') && n!==name)!;
    await writeFile(join(root,cedarName),originalBytes,{mode:0o600});
    assert.equal((await b.call(zid,'/api/reopen',{documentId:cs.documentId})).status,409);
    assert.match((await b.call(zid,'/?view=workshop')).text,/Some saved briefs are unavailable/u);
    assert.equal((await b.call(aid,'/api/reopen',{documentId:before.documentId})).status,200);
  } finally {await server.close();await rm(root,{recursive:true,force:true});}
});

test('delayed completion stays in its originating account and cannot replace the other account work',async()=>{
  const a=syntheticAccount('harbor'),z=syntheticAccount('cedar');
  let release!:()=>void, started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  const began=new Promise<void>(resolve=>{started=resolve;});
  const server=await start({...a,provider:{...a.provider,async generate(model){started();await gate;return a.provider.generate(model);}},accounts:[z]});
  try {
    const b=browser(server),aid=a.context.context.account.accountId,zid=z.context.context.account.accountId;
    await b.call(aid,'/');
    const pending=b.call(aid,'/api/generate',envelope());await began;
    await b.call(zid,'/');
    const cedar=(await b.call(zid,'/api/generate',envelope())).json();
    const before=(await b.call(zid,'/api/work-state',{})).json();
    release();const completed=await pending;
    assert.equal(completed.status,200);
    assert.equal(completed.json().location,accountPath(aid)+'/?draft=1');
    assert.match(completed.json().html,/name="c3-account" content="acct-harbor"/u);
    assert.deepEqual((await b.call(zid,'/api/work-state',{})).json(),before);
    assert.equal((await b.call(zid,'/api/work-state',{})).json().recordId,cedar.recordId);
    assert.notEqual(cedar.recordId,completed.json().recordId);
  } finally {release();await server.close();}
});

test('canonical registry rejects duplicate identities before opening a listener',async()=>{
  const a=syntheticAccount('harbor');
  await assert.rejects(start({...a,accounts:[a]}),/duplicate canonical account/u);
});


test('account route adapter preserves original form values, escaping and the exact CSP script',()=>{
  const a=syntheticAccount('harbor'),accountId=a.context.context.account.accountId;
  const page=renderC3Page(a.context,{page:'prepare',request:{...request,audience:'/?view=workshop',intendedOutcome:'<script>original prose</script>'}},'csrf',undefined,
    {accountId,accounts:[{accountId,accountName:'Harbor <script>literal</script>'}]});
  assert.ok(page.includes('value="/?view=workshop"'));
  assert.ok(page.includes('&lt;script&gt;original prose&lt;/script&gt;'));
  assert.ok(page.includes('Harbor &lt;script&gt;literal&lt;/script&gt;'));
  assert.equal(page.split('<script>')[1]!.split('</script>')[0],C3_CLIENT_SCRIPT);
});
