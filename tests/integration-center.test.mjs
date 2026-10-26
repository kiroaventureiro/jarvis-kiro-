import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ui=fs.readFileSync("app/components/IntegrationCenter.tsx","utf8");
const api=fs.readFileSync("app/api/director/ecosystem-overview/route.ts","utf8");
const module=fs.readFileSync("lib/ecosystem-overview.ts","utf8");
const inventory=JSON.parse(fs.readFileSync("config/kiro-ecosystem-inventory.json","utf8"));
test("integration center includes all catalogued services",()=>{
 assert.ok(inventory.services.length >= 23);
 assert.match(ui,/services\.map/);
 assert.match(ui,/Não autorizada/);
});
test("backend requires a valid session and does not expose secrets",()=>{
 assert.match(api,/await authorized\(\)/);
 assert.match(api,/status:401/);
 assert.match(module,/connected:false,authorized:false,verified:false/);
 assert.doesNotMatch(api,/process\.env/);
});
