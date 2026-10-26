import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync("lib/creative-production-engine.ts","utf8");
const route=fs.readFileSync("app/api/director/creative-plan/route.ts","utf8");
test("creative engine isolates character casts by project and includes continuity rules",()=>{
 assert.ok(source.includes("p.id===input.projectId"));
 assert.ok(source.includes("r.project===input.projectId"));
 assert.ok(source.includes("project.characters.join"));
});
test("creative plan is a draft without generation or publishing",()=>{
 assert.ok(source.includes("externalGenerationExecuted:false,publicationEnabled:false"));
 assert.ok(source.includes("reviewRequired:true"));
 assert.ok(route.includes("await authorized()"));
 assert.ok(!route.includes("fetch("));
});
