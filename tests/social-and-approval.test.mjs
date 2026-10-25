import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const social=fs.readFileSync("lib/jarvis-social-hub.ts","utf8");
const api=fs.readFileSync("app/api/director/social-readiness/route.ts","utf8");
const approvals=fs.readFileSync("lib/jarvis-approval-policy.ts","utf8");
test("social readiness never claims active accounts",()=>{
 for(const network of ["youtube","instagram","tiktok","spotify"])assert.match(social,new RegExp(network+":\\\\{"));
 assert.match(api,/await authorized\\(\\)/);
 assert.match(api,/dataAvailable:false/);
 assert.doesNotMatch(api,/fetch\\(/);
});
test("write actions remain blocked even with proposed approval",()=>{
 assert.match(approvals,/requiresApproval:true/);
 assert.match(approvals,/allowed:false,requiresApproval:true/);
 assert.match(approvals,/execução desabilitada/);
});
