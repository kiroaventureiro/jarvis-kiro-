import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const config=JSON.parse(fs.readFileSync("config/jarvis-local-skills.json","utf8"));
const source=fs.readFileSync("lib/jarvis-local-skills.ts","utf8");
const route=fs.readFileSync("app/api/director/local-skills/route.ts","utf8");
test("four local skills without remote execution",()=>{
 assert.equal(config.skills.length,4);
 assert.equal(config.remoteExecution,false);
 assert.ok(source.includes("buildCreativePlan("));
 assert.ok(source.includes("continuityChecklist("));
});
test("skill API validates inputs and requires login",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:401"));
 assert.ok(route.includes("sceneCount"));
 assert.ok(!route.includes("fetch("));
});
