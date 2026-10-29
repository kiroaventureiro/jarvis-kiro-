import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const cfg=JSON.parse(fs.readFileSync("config/ai-provider-routing.json","utf8"));
const source=fs.readFileSync("lib/ai-provider-selector.ts","utf8");
const route=fs.readFileSync("app/api/director/ai-routing/route.ts","utf8");
test("AI routing prioritizes free candidates but avoids false free claims",()=>{
 assert.equal(cfg.defaultMode,"free_first");
 assert.equal(cfg.paidFallback,"explicit_approval_only");
 assert.ok(cfg.guardrails.neverAutoPurchase);
 assert.ok(cfg.guardrails.doNotAssumeFreeTier);
 assert.ok(cfg.providers.length>=8);
 assert.ok(source.includes("eligible:false"));
});
test("routing stays authenticated and never calls an external model",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:401"));
 assert.ok(!route.includes("fetch("));
});
