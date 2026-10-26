import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("lib/jarvis-readiness-report.ts","utf8");
const route=fs.readFileSync("app/api/director/readiness-report/route.ts","utf8");
test("readiness report explicitly distinguishes plans and real access",()=>{
 for(const item of ["liveConnectionsVerified:0","productionReleaseApproved:false","n8nConnected:false","persistentTaskStoreConnected:false"])
 assert.ok(source.includes(item));
});
test("readiness endpoint requires authentication and exposes no secrets",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:401"));
 assert.ok(!route.includes("process.env"));
});
