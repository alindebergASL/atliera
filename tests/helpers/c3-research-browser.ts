import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RunningC3Server } from '../../src/c3/service.ts';
import { accountPath } from '../../src/c3/workspace-route.ts';
const realHttp = process.env.C3_TEST_REAL_HTTP === '1';
class Response extends EventEmitter {
  status = 200; headers: Record<string,string> = {}; text = ''; writableEnded = false;
  done: Promise<void>; finish!: () => void;
  constructor() { super(); this.done = new Promise(resolve => { this.finish = resolve; }); }
  setHeader(k:string,v:string) { this.headers[k] = v; }
  writeHead(s:number,h:Record<string,string>) { this.status=s; Object.assign(this.headers,h); }
  end(s = '') { this.text=s; this.writableEnded=true; this.finish(); }
}
export function researchBrowser(server: RunningC3Server) {
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
