import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("lib/agents/capability-inventory.ts", "utf8");
const route = fs.readFileSync("app/api/director/agent-capabilities/route.ts", "utf8");

function inventory() {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {exports});
  return exports.capabilityInventory();
}

function handler(authenticated, configured = true) {
  const exports = {};
  let reads = 0;
  const require = id => {
    if (id === "next/server") return {NextResponse:Response};
    if (id.endsWith("/auth")) return {authorized:async()=>authenticated};
    if (id.endsWith("/agents/capability-inventory")) return {capabilityInventory:inventory};
    if (id.endsWith("/connectors/server")) return {
      connectorStore:{configured:()=>configured},
      connectors:{overview:async()=>{reads++; return {providers:[
        {provider:"github",connection:{status:"connected",verifiedAt:"2026-11-03T00:00:00Z",resources:[{id:"repo"}],grants:["read"]},writeAllowlist:[]},
        {provider:"vercel",connection:null,writeAllowlist:[]},
        {provider:"supabase",connection:null,writeAllowlist:[]},
      ]}}},
    };
    if (id.endsWith("/agent-transport-contract")) return {AGENT_TRANSPORT:{enabled:false,allowRemoteExecution:false}};
    if (id.endsWith("/agent-transport-auth")) return {sourceSecret:()=>null};
    throw Error("unexpected import: "+id);
  };
  vm.runInNewContext(ts.transpileModule(route, {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{exports,require,Response,Date});
  return {get:exports.GET,reads:()=>reads};
}

test("inventory represents candidates, not preactivated agents",()=>{
  const result = inventory();
  assert.equal(result.local.length,4);
  assert.equal(result.specialists.length,5);
  assert.equal(result.external.length,32);
  assert.equal(new Set(result.external.map(x=>x.id)).size,32);
  assert.ok(result.external.every(x=>x.state==="candidate_not_installed" && x.execution==="not_connected"));
  assert.ok(result.specialists.every(x=>x.state==="guidance_only"));
});

test("unauthenticated caller receives no catalog or vault access",async()=>{
  const h=handler(false);
  const response=await h.get();
  assert.equal(response.status,401);
  assert.equal(h.reads(),0);
});

test("authorized inventory does not misreport connection metadata as live execution",async()=>{
  const h=handler(true);
  const response=await h.get();
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.connectors.providers[0].state,"verified_metadata_only");
  assert.equal(result.connectors.providers[0].writeAllowed,false);
  assert.equal(result.agentTransport.remoteExecutionAvailable,false);
  assert.equal(h.reads(),1);
  assert.match(response.headers.get("cache-control"),/no-store/);
});

test("missing connector vault is disclosed without opening connections",async()=>{
  const h=handler(true,false);
  const result=await (await h.get()).json();
  assert.equal(result.connectors.state,"vault_not_configured");
  assert.deepEqual(result.connectors.providers,[]);
  assert.equal(h.reads(),0);
});
