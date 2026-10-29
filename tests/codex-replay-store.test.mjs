import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../lib/codex/replay-store.ts", import.meta.url),"utf8")
  .replace(/^import "server-only";\s*/,"");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

function makeStore(configured=true) {
  const state={audit:[],plans:[],oauth:{},connections:{}};
  const store={
    configured:()=>configured,
    update:async(fn)=>fn(state),
  };
  const exports={};
  vm.runInNewContext(compiled,{exports,Date,Object,Number,require:(id)=>{
    assert.equal(id,"../connectors/server");
    return {connectorStore:store};
  }});
  return {claim:exports.claimCodexNonce,state,store};
}
test("Codex claim uses persistent encrypted vault state and rejects replay",async()=>{
  const {claim,state}=makeStore();
  const now=Date.now(), nonce="unique_nonce_0123456789";
  assert.equal(await claim(nonce,now+60_000,now),true);
  assert.equal(await claim(nonce,now+60_000,now),false);
  assert.equal(state.codexNonceClaims[nonce],now+60_000);
});
test("Codex claim fails closed when vault missing or nonce invalid",async()=>{
  const now=Date.now();
  assert.equal(await makeStore(false).claim("unique_nonce_0123456789",now+60_000,now),false);
  assert.equal(await makeStore().claim("x",now+60_000,now),false);
  assert.equal(await makeStore().claim("unique_nonce_0123456789",now+600_000,now),false);
});
test("Codex claim expires old entries and fails closed on vault errors",async()=>{
  const {claim,state,store}=makeStore();
  const now=Date.now();
  state.codexNonceClaims={old_nonce_123456789:now-1};
  assert.equal(await claim("new_nonce_123456789",now+60_000,now),true);
  assert.equal("old_nonce_123456789" in state.codexNonceClaims,false);
  store.update=async()=>{throw Error("vault offline");};
  assert.equal(await claim("another_nonce_123456789",now+60_000,now),false);
});
