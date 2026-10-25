import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const handler=fs.readFileSync("app/api/director/task-preview/route.ts","utf8");
const schema=fs.readFileSync("lib/jarvis-task-envelope.ts","utf8");
test("task previews require authorization and do not call outside services",()=>{
 assert.ok(handler.includes("await authorized()"));
 assert.ok(handler.includes("status:401"));
 assert.ok(handler.includes("validateTaskEnvelope"));
 assert.ok(handler.includes("persisted:false,auditStored:false,simulationOnly:true"));
 assert.ok(!handler.includes("fetch("));
});
test("task envelope restricts workflows, payload and prevents false execution claims",()=>{
 assert.ok(schema.includes("Object.hasOwn(N8N_WORKFLOWS"));
 assert.ok(schema.includes('x.context!=="kiro"&&x.context!=="personal"'));
 assert.ok(schema.includes("executed:false"));
 assert.ok(schema.includes("NO_EXTERNAL_EXECUTION"));
});
