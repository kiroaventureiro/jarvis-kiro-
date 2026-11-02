import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("n8n can be connected from Jarvis settings, not only from code",()=>{
 const page=fs.readFileSync("app/configuracoes/page.tsx","utf8");
 const panel=fs.readFileSync("app/components/N8nConnectionSettings.tsx","utf8");
 assert.match(page,/<N8nConnectionSettings\s*\/>/);
 assert.match(panel,/Conectar n8n/);
 assert.match(panel,/Testar conexão/);
 assert.match(panel,/Desconectar/);
});
test("n8n credential route requires authentication and same-origin writes",()=>{
 const api=fs.readFileSync("app/api/director/n8n/route.ts","utf8");
 const connection=fs.readFileSync("lib/n8n/connection.ts","utf8");
 assert.match(api,/await authorized\(\)/);
 assert.match(api,/requestOriginAllowed\(request\)/);
 assert.match(api,/DESCONECTAR N8N/);
 assert.match(connection,/connectorStore\.update/);
 assert.match(connection,/redirect:"error"/);
 assert.match(connection,/X-N8N-API-KEY/);
 assert.match(connection,/N8N_HOST_NOT_ALLOWED/);
 assert.match(connection,/N8N_ADDRESS_BLOCKED/);
 assert.doesNotMatch(api,/apiKey:/);
});
test("n8n connection does not silently activate workflows",()=>{
 const connection=fs.readFileSync("lib/n8n/connection.ts","utf8");
 const registry=fs.readFileSync("lib/n8n-workflow-registry.ts","utf8");
 assert.match(registry,/enabled:false/);
 assert.doesNotMatch(connection,/executeWorkflow|webhook\//);
});
