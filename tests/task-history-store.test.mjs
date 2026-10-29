import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const store=fs.readFileSync("lib/task-history-store.ts","utf8");
const route=fs.readFileSync("app/api/director/task-history/route.ts","utf8");
test("history store defines persistence contract but does not silently fake data",()=>{
 assert.ok(store.includes("interface TaskHistoryStore"));
 assert.ok(store.includes("TASK_STORAGE_NOT_CONFIGURED"));
 assert.ok(store.includes("new UnconfiguredTaskStore()"));
});
test("history endpoint is private and fails closed without persistence",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:503"));
 assert.ok(route.includes("connected:false"));
});
