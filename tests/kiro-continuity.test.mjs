import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const catalog=JSON.parse(fs.readFileSync("config/kiro-continuity-rules.json","utf8"));
const route=fs.readFileSync("app/api/director/continuity/route.ts","utf8");
test("continuity rules keep required creative constraints",()=>{
 assert.ok(catalog.rules.some(r=>r.id==="pfp-dogs"&&r.severity==="hard"));
 assert.ok(catalog.rules.some(r=>r.id==="tv-closing"));
 assert.ok(catalog.reviewRequiredForNewCanon);
 assert.equal(new Set(catalog.rules.map(r=>r.id)).size,catalog.rules.length);
});
test("continuity API is access controlled and read only",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:401"));
 assert.ok(!route.includes("export async function POST"));
});
