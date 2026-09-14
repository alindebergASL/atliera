/** Public synthetic offline fixture. No network, provider, historic account files or credentials. */
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {syntheticWorkshopContext,syntheticMeetingCandidate,syntheticMeetingRequest} from './c3-workshop.ts';
import {createGenerationRecord,createC3ModelRequest} from '../../src/c3/generation-contract.ts';
import {createRecordOriginReceipt,LocalWorkStore,newWorkDocumentId} from '../../src/c3/work-store.ts';
import {BoundedResearchExecution} from '../../src/c3/research-run.ts';
import {RESEARCH_HARD_LIMITS} from '../../src/c3/research-source.ts';
import type {AccountResearchConfiguration} from '../../src/c3/research-service.ts';
import type {InformationLaunchConfiguration} from '../../src/c3/account-information-config.ts';
import {admitRetainedInformationAttempt} from '../../src/c3/account-information-adapter.ts';
import {LocalInformationStore} from '../../src/c3/account-information-store.ts';
export async function bootstrapInformationDemo():Promise<void> {
const root=mkdtempSync(join(tmpdir(),'atliera-uv1-synthetic-'));const principal='synthetic.operator';const workStore={root:join(root,'work'),principal};
const context=syntheticWorkshopContext();const accountId=context.context.account.accountId;
const accepted=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest,undefined,'5'),syntheticMeetingCandidate(context),context);
if(accepted.outcome!=='succeeded')throw Error('Synthetic accepted fixture was refused');
const receipt=createRecordOriginReceipt(accepted,'synthetic','uv1-public-authored-fixture');
const store=new LocalWorkStore({...workStore,originReceipt:r=>r.recordId===accepted.recordId?receipt:undefined},context);
const documentId=newWorkDocumentId();store.save(documentId,0,{record:accepted,records:[accepted],correctionNote:'',sectionNotes:{},instruction:'',pendingRevision:null,pendingRevisionToken:null,proposal:null,proposalStale:false,workVersion:1,informationAttachments:[]},{title:'Synthetic meeting preparation · UV1'});
const failed=createGenerationRecord(createC3ModelRequest(context,syntheticMeetingRequest),syntheticMeetingCandidate(context),context);
const attempt={context,record:failed,ancestry:[],receipt:createRecordOriginReceipt(failed,'synthetic','uv1-public-failed-check-fixture')};
const items=admitRetainedInformationAttempt(attempt,{principal,accountId,at:new Date().toISOString()});
const information=new LocalInformationStore(workStore,accountId);for(const item of items)information.admit(item);
const researchRoot=join(root,'research');mkdirSync(researchRoot,{mode:0o700});
const research:AccountResearchConfiguration={accountId,principal,enabled:false,retentionRoot:researchRoot,validFrom:'2026-09-13T00:00:00.000Z',validUntil:'2026-09-14T00:00:00.000Z',scope:{accountId,principal,question:'Synthetic corroboration demonstration; no real account claims.',authorizationRef:'Offline public synthetic fixture only; no network grant',allowedHosts:['first.example.org','second.example.org','conflict.example.org'],targets:[['first','Synthetic direct report'],['second','Synthetic independent report'],['conflict','Synthetic contradictory report']].map(([host,publisher])=>({url:'https://'+host+'.example.org/report',publisher:publisher!,entityId:context.context.admittedSources[0]!.entity.entityId,relationshipToAccount:'account' as const,redirectUrls:[]})),limits:{...RESEARCH_HARD_LIMITS}}};
// The production retention execution receives an explicitly synthetic in-memory transport only here.
// The browser launch below is disabled and has no transport fixture or provider fixture.
const execution=new BoundedResearchExecution({...research,enabled:true,transport:async ({url})=>({status:200,mediaType:'text/plain',bodyComplete:true,body:Buffer.from(url.includes('conflict')?'SYNTHETIC contradiction: the pilot did not begin in September 2026. Authored fixture, no live research.':url.includes('second')?'SYNTHETIC separately authored report: an independent observer reports the pilot began in September 2026. No live research.':'SYNTHETIC firsthand report: the pilot began in September 2026. Authored public fixture, no live research.')})});
await execution.start({accountId,principal,sessionId:'offline-synthetic-bootstrap'},'uv1-synthetic').completion;
const config:InformationLaunchConfiguration={kind:'atliera.c3.retained-information-launch',schemaVersion:'1',workStore,accounts:[{context,synthetic:true,attempts:[attempt],origins:[{record:accepted,receipt}],research},{context:syntheticWorkshopContext('cedar'),synthetic:true,attempts:[],origins:[]}]};
const configPath=join(root,'launch.json');writeFileSync(configPath,JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});
const command='C3_PORT=4317 node '+JSON.stringify(resolve('dist/c3/atliera-c3.js'))+' serve-information '+JSON.stringify(configPath);
const report={root,configPath,command,accountUrl:'http://127.0.0.1:4317/accounts/'+accountId+'/#'+items[0]!.id,isolationUrl:'http://127.0.0.1:4317/accounts/acct-cedar/',documentId,candidateId:items[0]!.id,sequence:['Open candidate View evidence and review; inspect original incomplete check.','Record validation with firsthand basis and reasoning; Save information review.','Edit wording to Synthetic pilot began in September 2026; time scope September 2026. Earlier validation stays with earlier wording.','Validate the narrowed wording, then Assess retained evidence: select first and second reports, Supports, independent origins established; supply distinct origin groups and relevance reasoning.','Assess contradictory retained report; inspect prominent conflict and prior validation history.','Reopen Synthetic meeting preparation from Saved briefs; return to Account and Add to working context. Open session draft, Save, restart with exact same launch command, reopen.','Change account information, reopen saved brief, inspect changed status beside as-saved snapshot; Refresh working snapshot then explicitly Save.','Check /healthz before and after: disabled provider and zero generation attempts for both accounts.']};
writeFileSync(join(root,'instructions.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(JSON.stringify(report,null,2));

}
