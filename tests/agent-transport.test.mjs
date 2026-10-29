import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const contract=fs.readFileSync("lib/agent-transport-contract.ts","utf8");
const route=fs.readFileSync("app/api/director/agent-transport/route.ts","utf8");
test("transport is disabled until cryptographic authentication exists",()=>{
 for(const item of ["requiresReplayProtection:true","requiresSignatureVerification:true","allowRemoteExecution:false","enabled:false"])
 assert.ok(contract.includes(item));
 assert.ok(route.includes("status:503"));
 assert.ok(!route.includes("fetch("));
});
test("transport status requires authentication",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:401"));
});
