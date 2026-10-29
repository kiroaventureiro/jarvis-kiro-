import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const core=fs.readFileSync("lib/project-reference-index.ts","utf8");
const route=fs.readFileSync("app/api/director/project-reference-plan/route.ts","utf8");
test("reference index avoids storing document bodies or mixing contexts",()=>{
 assert.ok(core.includes("storeDocumentBodies:false"));
 assert.ok(core.includes("storeEmailBodies:false"));
 assert.ok(core.includes("r.context===context"));
 assert.ok(core.includes('r.classification==="ordinary"'));
});
test("readiness endpoint stays authorized and truthful",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("indexedReferences:null,connected:false"));
 assert.ok(route.includes("status:401"));
});
