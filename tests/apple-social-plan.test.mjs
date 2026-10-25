import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const apple=JSON.parse(fs.readFileSync("config/apple-integration-plan.json","utf8"));
const route=fs.readFileSync("app/api/director/device-plan/route.ts","utf8");
const social=fs.readFileSync("lib/social-metrics-contracts.ts","utf8");
test("Apple access separated by purpose without claiming connection",()=>{
 assert.deepEqual(apple.features.map(x=>x.id),["iphone_pwa","apple_sign_in","icloud_mail","device_companion"]);
 assert.ok(apple.features.every(x=>x.connected===false));
});
test("plan endpoint is session guarded and read only",()=>{
 assert.match(route,/await authorized\(\)/);assert.match(route,/status:401/);
 assert.doesNotMatch(route,/fetch\(/);assert.match(route,/liveAccess:false/);
});
test("social metrics never grant publishing or pretend authentication",()=>{
 for(const p of ["youtube","instagram","tiktok"])assert.match(social,new RegExp(p+":"));
 assert.match(social,/requiresApprovalForPublishing:true/);
 assert.match(social,/connected:false/);
});
