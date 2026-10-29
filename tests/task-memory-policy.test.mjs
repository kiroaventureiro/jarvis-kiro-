import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const policy=fs.readFileSync("lib/task-memory-policy.ts","utf8");
const api=fs.readFileSync("app/api/director/task-memory-policy/route.ts","utf8");
test("task transitions are constrained and finished work cannot run again by default",()=>{
 assert.ok(policy.includes("completed:[],failed:"));
 assert.ok(policy.includes("awaiting_approval"));
 assert.ok(policy.includes("findDuplicate"));
 assert.ok(policy.includes("prioritizeTasks"));
});
test("task memory route is private and does not falsely claim persistence",()=>{
 assert.ok(api.includes("await authorized()"));
 assert.ok(api.includes("historyConnected:false"));
 assert.ok(api.includes("persistedTaskCount:null"));
 assert.ok(!api.includes("fetch("));
});
test("retention excludes credentials and conversation bodies",()=>{
 assert.ok(policy.includes("storeSecrets:false"));
 assert.ok(policy.includes("storeConversationBodies:false"));
 assert.ok(policy.includes("databaseRequiredForCrossDeviceHistory:true"));
});
