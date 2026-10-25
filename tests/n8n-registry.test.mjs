import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const plans=JSON.parse(fs.readFileSync("config/workflow-blueprints.json","utf8"));
const registry=fs.readFileSync("lib/n8n-workflow-registry.ts","utf8");
const route=fs.readFileSync("app/api/director/n8n-workflows/route.ts","utf8");
test("workflow plans are complete but cannot execute",()=>{
 assert.equal(plans.flows.length,5);
 assert.ok(plans.flows.every(f=>f.sideEffects===false));
 assert.match(registry,/executionsEnabled:false/);
 assert.match(route,/executionEnabled:false/);
 assert.doesNotMatch(route,/fetch\(/);
});
test("workflow management requires session and blocks POST",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/status:401/);
 assert.match(route,/status:403/);
});
