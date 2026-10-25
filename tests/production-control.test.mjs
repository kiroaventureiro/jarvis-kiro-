import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const contract=fs.readFileSync("lib/production-control-contracts.ts","utf8");
const route=fs.readFileSync("app/api/director/production-control/route.ts","utf8");
test("control route is authenticated and actions fail closed",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/export async function POST/);
 assert.match(route,/Execução bloqueada/);
 assert.doesNotMatch(route,/fetch\(/);
});
test("stream and automation actions need approval and stay disabled",()=>{
 for(const name of ["obs_start_stream","obs_stop_stream","kiro_tv_change_playlist","n8n_run_workflow"])
  assert.ok(contract.includes(name));
 assert.match(contract,/approval:true/);
 assert.match(contract,/connected:false, enabled:false/);
});
