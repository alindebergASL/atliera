import {constants,openSync,closeSync,fstatSync,fsyncSync,readSync,writeFileSync,mkdirSync,lstatSync,realpathSync,opendirSync,unlinkSync,linkSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';
import {canonicalJson} from './context.ts';import {acquireWorkStoreLock} from './work-store-lock.ts';
import {informationHash,validateInformation,type AccountInformation} from './account-information.ts';
import type {WorkStoreOptions} from './work-store.ts';
const repo=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
const safeId=(id:string):string=>{if(!/^info_[a-f0-9]{64}$/u.test(id))throw Error('Invalid information identifier');return id;};
/** Dedicated sibling of configured work root. Immutable publications, account/operator CAS.
 * Checksums detect corruption; the local filesystem owner remains trusted. */
export class LocalInformationStore {
 readonly root:string;private readonly prefix:string;
 constructor(private readonly options:Pick<WorkStoreOptions,'root'|'principal'|'fault'>,private readonly accountId:string){
  if(!isAbsolute(options.root)||!/^[A-Za-z0-9][A-Za-z0-9_.@-]{2,127}$/u.test(options.principal)||!/^[A-Za-z0-9_-]{1,120}$/u.test(accountId))throw Error('Trusted storage authority required');
  this.root=resolve(options.root)+'.information';const rel=relative(repo,this.root);
  if(!(rel==='..'||rel.startsWith(`..${sep}`)||isAbsolute(rel)))throw Error('Information store must be outside repository');
  try{mkdirSync(this.root,{mode:0o700});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  this.assertRoot();this.prefix=informationHash([options.principal,accountId]).slice(0,32)+'-';
 }
 private assertRoot():void {const s=lstatSync(this.root);if(!s.isDirectory()||s.isSymbolicLink()||realpathSync(this.root)!==this.root||(s.mode&0o077)!==0||s.uid!==process.getuid?.())throw Error('Information root must be private, owned and without symlinks');}
 private names():string[]{this.assertRoot();const names:string[]=[];const d=opendirSync(this.root);try{let e;while((e=d.readSync())){names.push(e.name);if(names.length>4096)throw Error('Information store limit');}}finally{d.closeSync();}return names.sort();}
 private filename(id:string,version:number):string {return this.prefix+safeId(id)+'.v'+String(version).padStart(6,'0')+'.json';}
 private versions(id:string):string[]{safeId(id);return this.names().filter(n=>new RegExp('^'+this.prefix+id+'\\.v[0-9]{6}\\.json$','u').test(n));}
 private read(name:string):AccountInformation {
  this.assertRoot();const fd=openSync(resolve(this.root,name),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=fstatSync(fd);const pending=s.nlink===2&&this.names().filter(n=>/^\.information-pending-[a-f0-9]{32}$/u.test(n)).filter(n=>{const p=lstatSync(resolve(this.root,n));return p.isFile()&&!p.isSymbolicLink()&&p.ino===s.ino&&p.dev===s.dev;}).length===1;
   if(!s.isFile()||s.nlink!==1&&!pending||s.size>2_000_000||(s.mode&0o077)!==0||s.uid!==process.getuid?.())throw Error('Unsafe information record');
   const b=Buffer.alloc(s.size+1);let size=0;while(size<b.length){const n=readSync(fd,b,size,b.length-size,null);if(!n)break;size+=n;}const after=fstatSync(fd);
   if(size!==s.size||after.size!==s.size||after.mtimeMs!==s.mtimeMs)throw Error('Information changed during read');
   const bytes=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,size));const envelope=JSON.parse(bytes) as {item:AccountInformation;sha256:string};
   if(Object.keys(envelope).sort().join(',')!=='item,sha256'||canonicalJson(envelope)+'\n'!==bytes||envelope.sha256!==informationHash(envelope.item)||name!==this.filename(envelope.item.id,envelope.item.version))throw Error('Information readback mismatch');
   validateInformation(envelope.item,this.accountId,this.options.principal);return envelope.item;
  }finally{closeSync(fd);}
 }
 load(id:string):AccountInformation {const names=this.versions(id);if(!names.length)throw Error('Information unavailable for account/operator');return this.read(names.at(-1)!);}
 list():AccountInformation[]{const pattern=new RegExp('^'+this.prefix+'(info_[a-f0-9]{64})\\.v[0-9]{6}\\.json$','u');const ids=[...new Set(this.names().flatMap(n=>pattern.exec(n)?.[1]??[]))];return ids.map(id=>this.load(id));}
 private cleanPending(dir:number):void {
  const names=this.names();for(const name of names.filter(n=>/^\.information-pending-[a-f0-9]{32}$/u.test(n))){const p=lstatSync(resolve(this.root,name));if(!p.isFile()||p.isSymbolicLink()||(p.mode&0o077)!==0||p.uid!==process.getuid?.())throw Error('Unsafe pending information');
   if(p.nlink===2){const matches=names.filter(n=>/^[a-f0-9]{32}-info_[a-f0-9]{64}\.v[0-9]{6}\.json$/u.test(n)).filter(n=>{const s=lstatSync(resolve(this.root,n));return s.isFile()&&!s.isSymbolicLink()&&s.ino===p.ino&&s.dev===p.dev;});if(matches.length!==1)throw Error('Unsafe pending link');}else if(p.nlink!==1)throw Error('Unsafe pending link');unlinkSync(resolve(this.root,name));
  }fsyncSync(dir);
 }
 save(item:AccountInformation,expectedVersion:number):AccountInformation {
  validateInformation(item,this.accountId,this.options.principal);if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||expectedVersion>=999999)throw Error('Invalid expected version');
  this.assertRoot();const dir=acquireWorkStoreLock(this.root);let temp:string|undefined;
  try{this.assertRoot();this.cleanPending(dir);const names=this.versions(item.id);const prior=names.length?this.read(names.at(-1)!):undefined;
   if((prior?.version??0)!==expectedVersion)throw Error('Information save conflict. Reopen current information; reasoning kept.');
   if(prior&&canonicalJson(prior)===canonicalJson(item))return prior;
   if(item.version!==expectedVersion+1)throw Error('Information version mismatch');
   if(prior&&(canonicalJson(item.history.slice(0,-1))!==canonicalJson(prior.history)||canonicalJson(item.origin)!==canonicalJson(prior.origin)||canonicalJson(item.statements.slice(0,prior.statements.length))!==canonicalJson(prior.statements)||!prior.evidence.every(e=>item.evidence.some(n=>canonicalJson(n)===canonicalJson(e)))))throw Error('Historical information changed');
   if(!prior&&this.list().length>=100||this.names().length>=4090)throw Error('Information store limit');
   const bytes=canonicalJson({item,sha256:informationHash(item)})+'\n';if(Buffer.byteLength(bytes)>2_000_000)throw Error('Information record too large');
   temp=resolve(this.root,'.information-pending-'+randomBytes(16).toString('hex'));const fd=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
   try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
   this.options.fault?.('before-publish');this.assertRoot();const name=this.filename(item.id,item.version);linkSync(temp,resolve(this.root,name));this.options.fault?.('after-link');unlinkSync(temp);temp=undefined;fsyncSync(dir);this.options.fault?.('after-publish');
   const result=this.read(name);if(canonicalJson(result)!==canonicalJson(item))throw Error('Information save not confirmed');return result;
  }finally{if(temp)try{unlinkSync(temp);}catch{/* original failure */}closeSync(dir);}
 }
 /** Idempotent trusted admission never overwrites later operator reviews. */
 admit(item:AccountInformation):AccountInformation {const found=this.versions(item.id);return found.length?this.load(item.id):this.save(item,0);}
}
