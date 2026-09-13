import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { modelCommandLaunchArguments, readAccountModelCommand } from '../../src/c3/model-command-config.ts';
test('SYNTHETIC account command is explicit and private; never read from browser or ambient model command', () => {
  assert.deepEqual(modelCommandLaunchArguments([]), { modelConfig: undefined, remaining: [] });
  assert.deepEqual(modelCommandLaunchArguments(['--research-config','/private/research','--model-command-config','/private/model']), { modelConfig: '/private/model', remaining: ['--research-config','/private/research'] });
  assert.throws(()=>modelCommandLaunchArguments(['--model-command-config']));
  assert.throws(()=>modelCommandLaunchArguments(['--model-command-config','/private/a','--model-command-config','/private/b']));
  const root=mkdtempSync(join(tmpdir(),'cd1-command-synthetic-')), path=join(root,'config.json');
  try {
    const config={accountId:'synthetic-account',principal:'synthetic.operator',command:'/synthetic/nonexistent-command',args:[],timeoutMs:300000,auditRoot:join(root,'audit')};
    writeFileSync(path,JSON.stringify(config),{mode:0o600});
    assert.equal(readAccountModelCommand(path,config.accountId,config.principal).provider.executionMode,'external','constructor does not execute command');
    assert.throws(()=>readAccountModelCommand(path,'foreign',config.principal));
    assert.throws(()=>readAccountModelCommand(path,config.accountId,'foreign'));
    for(const bad of [{...config,timeoutMs:null},{...config,enabled:true},{...config,timeoutMs:999999},{...config,command:'ambient-command'},{...config,args:['\0']}]) {
      writeFileSync(path,JSON.stringify(bad));assert.throws(()=>readAccountModelCommand(path,config.accountId,config.principal));
    }
  } finally {rmSync(root,{recursive:true,force:true});}
});
