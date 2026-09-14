import test from 'node:test';import assert from 'node:assert/strict';
import {renderAccountInformation,renderInformationAttachments} from '../../src/c3/account-information-render.ts';
import {newInformation,informationAttachment,reviseInformation} from '../../src/c3/account-information.ts';
const a={principal:'synthetic.operator',accountId:'acct-harbor',at:'2026-09-13T12:00:00.000Z'};
test('escaped uncertainty, independent assessment language and unavailable current status',()=>{
 const item=newInformation({text:'<script>alert(1)</script> Synthetic statement.',entity:'Harbor',timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:'a'.repeat(64),binding:'synthetic'}},a);
 const html=renderAccountInformation([item],[],true,true,1);
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Firsthand basis/);assert.match(html,/Human assessment/);assert.match(html,/Not independently checked/);assert.match(html,/View evidence and review/);
 assert.match(renderInformationAttachments([informationAttachment(item)],null,2,true),/Current status unavailable/);
 assert.match(renderInformationAttachments([informationAttachment(item)],null,2,true),/data-unsaved="true"/);
 assert.ok(!renderAccountInformation([item],[],false,false,0).includes('data-information-form'));
});


test('review caveats are expandable, notes have stored attribution and search excludes status/history metadata',async()=>{
 const {sourceInformation}=await import('../../src/c3/account-information-adapter.ts');
 const {syntheticWorkshopContext}=await import('../fixtures/c3-workshop.ts');
 const original=sourceInformation(syntheticWorkshopContext(),a)[0]!;
 const item=reviseInformation(original,{action:'reopen',reason:'Operator trial paragraph stays verbatim in history'},a);
 const before=JSON.stringify(item);const html=renderAccountInformation([item],item.evidence,true,true,1);
 assert.match(html,/Latest recorded review · reopen · 2026-09-13T12:00:00.000Z/);
 assert.match(html,/Configured operator synthetic.operator/);assert.ok(html.includes(item.history[0]!.change.reason));
 assert.match(html,/<details class="information-status-detail"><summary>Why these labels/);
 assert.match(html,/Evidence published:/);assert.match(html,/Current through:/);
 assert.match(html,/Required: select at least one attached evidence passage/);assert.match(html,/brief’s separate Save/);
 assert.match(html,/information-review-actions/);assert.match(html,/data-information-cancel>Cancel review/);
 const searchable=[...html.matchAll(/<(?:span|p)[^>]*data-information-search-text[^>]*>(.*?)<\/(?:span|p)>/gu)].map(m=>m[1]).join(' ');
 assert.ok(searchable.includes(item.evidence[0]!.sourceId));assert.ok(searchable.includes(item.entity));
 for(const excluded of ['Needs confirmation','Operator trial paragraph','retrieval dates do not establish','Configured operator'])assert.ok(!searchable.includes(excluded),excluded);
 for(const e of item.evidence){assert.ok(html.includes('Citation '+e.id.slice(3,15)));assert.ok(html.includes(e.id));assert.ok(html.includes(e.excerpt.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')));}
 assert.equal(JSON.stringify(item),before);
});
