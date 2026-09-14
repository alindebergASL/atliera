import {constants,openSync,closeSync,fstatSync,readFileSync,realpathSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {canonicalJson} from './context.ts';
import {informationHash} from './account-information.ts';
import {assertReplayIdentity} from './generation-contract.ts';
import {validateOriginReceipt,type RecordOriginReceipt} from './work-store.ts';
import type {C3GenerationRecord} from './generation-contract.ts';
import type {C3AccountServiceOptions} from './service.ts';
import type {FrozenC3ViewContext} from './view-context.ts';
import type {RetainedInformationAttempt} from './account-information-adapter.ts';
import type {AccountResearchConfiguration} from './research-service.ts';
import {DisabledC3ModelProvider} from './provider.ts';
export interface InformationLaunchConfiguration {
 readonly kind:'atliera.c3.retained-information-launch';readonly schemaVersion:'1';
 readonly workStore:{root:string;principal:string};
 readonly accounts:readonly {context:FrozenC3ViewContext;synthetic?:boolean;attempts:readonly RetainedInformationAttempt[];origins:readonly {record:C3GenerationRecord;receipt:RecordOriginReceipt}[];research?:AccountResearchConfiguration}[];
}
/** Explicit bounded private operator file only; no paths submitted through HTTP and no journal scan.
 * This source-only launch has no model or acquisition enablement path. */
export function readInformationLaunch(path:string):C3AccountServiceOptions[] {
 if(!isAbsolute(path)||realpathSync(path)!==resolve(path))throw Error('Exact private information configuration path required');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 let input:InformationLaunchConfiguration;
 try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size>24_000_000||stat.nlink!==1||(stat.mode&0o077)!==0||stat.uid!==process.getuid?.())throw Error('Private information configuration required');input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(fd)));}finally{closeSync(fd);}
 if(Object.keys(input).sort().join(',')!=='accounts,kind,schemaVersion,workStore'||input.kind!=='atliera.c3.retained-information-launch'||input.schemaVersion!=='1'||!Array.isArray(input.accounts)||!input.accounts.length||input.accounts.length>5)throw Error('Invalid retained information launch');
 return input.accounts.map(entry=>{
  if(Object.keys(entry).some(k=>!['context','attempts','origins','research','synthetic'].includes(k))||!Array.isArray(entry.attempts)||entry.attempts.length>10||!Array.isArray(entry.origins)||entry.origins.length>22)throw Error('Invalid retained account');
  const {context}=entry;if(canonicalJson(context.context)!==context.canonicalJson||informationHash(context.context)!==context.sha256)throw Error('Exact retained context required');
  for(const origin of entry.origins){assertReplayIdentity(origin.record,context);validateOriginReceipt(origin.receipt,origin.record);}
  if(entry.research?.enabled)throw Error('Retained information launch requires disabled acquisition');
  if(entry.synthetic!==undefined&&(typeof entry.synthetic!=='boolean'||entry.synthetic&&!context.context.custody.localTestOnly))throw Error('Synthetic launch requires explicit local fixture context');
  return {context,syntheticPreview:entry.synthetic,workStore:input.workStore,provider:new DisabledC3ModelProvider(),retainedInformationAttempts:entry.attempts,
   originReceipt:record=>entry.origins.find((e:{record:C3GenerationRecord;receipt:RecordOriginReceipt})=>canonicalJson(e.record)===canonicalJson(record))?.receipt,
   ...(entry.research?{research:{config:entry.research,networkEnabled:()=>false}}:{})};
 });
}
