import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const engine=fs.readFileSync("lib/creative-production-engine.ts","utf8");
const planner=fs.readFileSync("lib/creative-production-plan.ts","utf8");
const planRoute=fs.readFileSync("app/api/director/creative-plan/route.ts","utf8");
const scenesRoute=fs.readFileSync("app/api/director/creative-scenes/route.ts","utf8");
test("creative engine isolates character casts by project and continuity rules",()=>{
 assert.ok(engine.includes("p.id===input.projectId"));
 assert.ok(engine.includes("r.project===input.projectId"));
 assert.ok(engine.includes("project.characters.join"));
});
test("existing planner now includes scene drafts without replacing API",()=>{
 assert.ok(planner.includes('import { buildCreativePlan }'));
 assert.ok(planner.includes("sceneDraft=buildCreativePlan"));
 assert.ok(planner.includes('request.format==="landscape_16_9"?"video_16_9":"short_9_16"'));
 assert.ok(planner.includes("sceneDraft,requiresApproval:true,generationEnabled:false"));
});
test("both guarded APIs refuse external generation and publishing",()=>{
 assert.ok(engine.includes("externalGenerationExecuted:false,publicationEnabled:false"));
 for(const route of [planRoute,scenesRoute]){
 assert.ok(route.includes("await authorized()"));
 assert.ok(!route.includes("fetch("));
 }
});
