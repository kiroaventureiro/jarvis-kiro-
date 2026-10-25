import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const social=fs.readFileSync("lib/jarvis-social-hub.ts","utf8");
const api=fs.readFileSync("app/api/director/social-readiness/route.ts","utf8");
const approvals=fs.readFileSync("lib/jarvis-approval-policy.ts","utf8");
test("social readiness does not claim active accounts",()=>{
 for(const name of ["youtube","instagram","tiktok","spotify"])assert.ok(social.includes(name+":{"));
 assert.ok(api.includes("await authorized()"));
 assert.ok(api.includes("dataAvailable:false"));
 assert.ok(!api.includes("fetch("));
});
test("dangerous actions remain disabled even with proposed approval",()=>{
 assert.ok(approvals.includes("requiresApproval:true"));
 assert.ok(approvals.includes("allowed:false,requiresApproval:true"));
 assert.ok(approvals.includes("execução desabilitada"));
});
