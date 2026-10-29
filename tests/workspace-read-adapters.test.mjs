import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const adapter=fs.readFileSync("lib/workspace-read-adapters.ts","utf8");
const route=fs.readFileSync("app/api/director/workspace-read/route.ts","utf8");
test("workspace gateway requires authorized session and valid provider/resource",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/status:401/);
 assert.match(route,/Provedor inválido/);
 assert.match(route,/Recurso inválido/);
 assert.match(route,/Autorização OAuth ainda não configurada/);
});
test("workspace adapters only fetch allowlisted provider read endpoints",()=>{
 assert.match(adapter,/googleapis\.com/);
 assert.match(adapter,/graph\.microsoft\.com/);
 assert.doesNotMatch(adapter,/method\\s*:\\s*["\x27](POST|PATCH|DELETE|PUT)/);
});
