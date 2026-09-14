import test from 'node:test';import assert from 'node:assert/strict';
import {renderAccountInformation,renderInformationAttachments} from '../../src/c3/account-information-render.ts';
import {newInformation,informationAttachment} from '../../src/c3/account-information.ts';
const a={principal:'synthetic.operator',accountId:'acct-harbor',at:'2026-09-13T12:00:00.000Z'};
test('escaped uncertainty, independent assessment language and unavailable current status',()=>{
 const item=newInformation({text:'<script>alert(1)</script> Synthetic statement.',entity:'Harbor',timeScope:'Unknown',evidence:[],origin:{kind:'source',contextSha256:'a'.repeat(64),binding:'synthetic'}},a);
 const html=renderAccountInformation([item],[],true,true,1);
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/Firsthand basis/);assert.match(html,/Human assessment/);assert.match(html,/Not independently checked/);assert.match(html,/View evidence and review/);
 assert.match(renderInformationAttachments([informationAttachment(item)],null,2,true),/Current status unavailable/);
 assert.match(renderInformationAttachments([informationAttachment(item)],null,2,true),/data-unsaved="true"/);
 assert.ok(!renderAccountInformation([item],[],false,false,0).includes('data-information-form'));
});
