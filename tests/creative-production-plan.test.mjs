import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const code=fs.readFileSync("lib/creative-production-plan.ts","utf8");
const api=fs.readFileSync("app/api/director/creative-plan/route.ts","utf8");
test("creative planning uses established canon and no external generation",()=>{
 assert.ok(code.includes("continuityChecklist(request.project)"));
 assert.ok(code.includes("findProjectMemory(request.project)"));
 assert.ok(code.includes("generationEnabled:false,externalRequestSent:false"));
});
test("creative planning API requires authorization and constrains external providers",()=>{
 assert.ok(api.includes("await authorized()"));
 assert.ok(api.includes("status:401"));
 assert.ok(api.includes('"grok","openart","invideo","capcut","suno"'));
 assert.ok(!api.includes("fetch("));
});
