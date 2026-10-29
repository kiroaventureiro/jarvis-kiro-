import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const registry=JSON.parse(fs.readFileSync("config/kiro-project-registry.json","utf8"));
const route=fs.readFileSync("app/api/director/project-memory/route.ts","utf8");
test("project memory preserves separate projects and provenance",()=>{
 assert.ok(registry.projects.length>=8);
 assert.equal(new Set(registry.projects.map(p=>p.id)).size,registry.projects.length);
 assert.ok(registry.projects.every(p=>p.context==="kiro"&&p.verifiedLive===false&&p.sources.length));
});
test("project memory endpoint requires authorization and disclaims live sync",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("liveSync:false"));
 assert.ok(!route.includes("fetch("));
});
