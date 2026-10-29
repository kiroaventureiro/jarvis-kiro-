import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const core=fs.readFileSync("lib/windows-agent-contract.ts","utf8");
const route=fs.readFileSync("app/api/director/windows-agent-plan/route.ts","utf8");
test("Windows plan blocks shell execution and live control",()=>{
 assert.ok(core.includes('execute_shell:{access:"forbidden",enabled:false}'));
 assert.ok(core.includes('allowed:false,command'));
 assert.ok(route.includes("Comandos locais desabilitados"));
 assert.ok(!route.includes("fetch("));
});
test("Windows planning endpoint requires session",()=>{
 assert.ok(route.includes("await authorized()"));
 assert.ok(route.includes("status:401"));
 assert.ok(route.includes("status:403"));
});
