/** Host-only LOCAL TLS proof. Run explicitly: node --import tsx tests/c3/c3-research-native.host.ts
 * Uses an ephemeral synthetic certificate and loopback listener. No public DNS/source request.
 * Socket permission errors are failures, never converted to a pass or synthetic coverage. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request } from 'node:https';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createTestOnlyResearchExchange } from '../../src/c3/research-native-https.ts';

test('LOCAL TLS: same pinned socket state machine; server identity, address, bounds, abort, deadline, encoding, redirect', async t => {
  const dir=mkdtempSync(join(tmpdir(),'c2-local-tls-'));
  const keyPath=join(dir,'synthetic-key.pem'),certPath=join(dir,'synthetic-cert.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=research.example.org','-addext','subjectAltName=DNS:research.example.org'],{stdio:'ignore'});
  const cert=readFileSync(certPath),key=readFileSync(keyPath);
  let requests=0;
  const server=createServer({key,cert},(req,res)=>{
    requests++;res.setHeader('content-type','text/plain');
    if(req.url==='/hang')return;
    if(req.url==='/large'){res.end(Buffer.alloc(200));return;}
    if(req.url==='/truncated'){res.setHeader('content-length','100');res.write('short');setTimeout(()=>res.destroy(),10);return;}
    if(req.url==='/encoded'){res.setHeader('content-encoding','gzip');res.end('unexpanded');return;}
    if(req.url==='/redirect'){res.statusCode=302;res.setHeader('location','/access');res.end('redirect');return;}
    res.end('SYNTHETIC service access requires review.');
  });
  server.on('tlsClientError',()=>{});
  try {
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve());});
    const bound=server.address();assert.ok(bound && typeof bound==='object');
    const exchange=createTestOnlyResearchExchange({request:(options,receive)=>request({...options,port:bound.port,ca:cert},receive)});
    const input=(path:string,signal=new AbortController().signal,timeoutMs=1000)=>({url:'https://research.example.org'+path,signal,maxBytes:100,timeoutMs});
    const result=await exchange(input('/access'),'127.0.0.1');assert.equal(result.bodyComplete,true);assert.equal(result.connectedAddress,'127.0.0.1');
    const beforeIdentity=requests;
    await assert.rejects(exchange({...input('/access'),url:'https://wrong.example.org/access'},'127.0.0.1'),/source_connection_refused/);assert.equal(requests,beforeIdentity,'wrong certificate identity cannot reach HTTP handler');
    const wrongAddress=createTestOnlyResearchExchange({request:(options,receive)=>request({...options,port:bound.port,ca:cert,lookup:((_host:unknown,_opts:unknown,callback:Function)=>callback(null,'127.0.0.1',4)) as any},receive)});
    await assert.rejects(wrongAddress(input('/access'),'127.0.0.2'),/source_connection_refused/);
    await assert.rejects(exchange(input('/large'),'127.0.0.1'),/source_size_refused/);
    await assert.rejects(exchange(input('/truncated'),'127.0.0.1'),/source_incomplete/);
    await assert.rejects(exchange(input('/encoded'),'127.0.0.1'),/source_type_refused/);
    const before=requests;const redirect=await exchange(input('/redirect'),'127.0.0.1');assert.equal(redirect.status,302);assert.equal(requests,before+1);
    const controller=new AbortController();const pending=exchange(input('/hang',controller.signal),'127.0.0.1');setTimeout(()=>controller.abort(),30);await assert.rejects(pending,/cancelled/);
    await assert.rejects(exchange(input('/hang',undefined,30),'127.0.0.1'),/timed_out/);
    t.diagnostic('Real loopback TLS only. Public-address policy tested separately with synthetic DNS; no live source claim.');
  } finally {server.closeAllConnections();if(server.listening) await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
