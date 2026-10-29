import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const route=fs.readFileSync("app/api/director/orchestrator/route.ts","utf8");
const core=fs.readFileSync("lib/jarvis-orchestrator.ts","utf8");
test("orchestrator requires authentication and restricted workflow IDs",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/status:\s*401/);
 assert.match(route,/project_report/);
 assert.match(route,/content_pipeline/);
 assert.match(route,/broadcast_health/);
 assert.doesNotMatch(route,/fetch\(/);
});
test("orchestration never executes before approval",()=>{
 assert.match(core,/executionEnabled:false/);
 assert.match(core,/requiresApproval:true/);
 assert.doesNotMatch(core,/fetch\(/);
});
