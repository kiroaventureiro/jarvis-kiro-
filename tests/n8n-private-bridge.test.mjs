import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
test("private n8n bridge is authenticated and owner gated",()=>{
 const worker=fs.readFileSync("app/api/director/n8n-bridge/route.ts","utf8");
 const owner=fs.readFileSync("app/api/director/n8n-jobs/route.ts","utf8");
 assert.match(worker,/bridgeAuth/);assert.match(owner,/await authorized\(\)/);
 assert.match(owner,/requestOriginAllowed\(request\)/);
});
test("queue persists encrypted in connector vault and worker is outbound only",()=>{
 const bridge=fs.readFileSync("lib/n8n/bridge.ts","utf8");
 const script=fs.readFileSync("scripts/n8n-bridge-worker.ps1","utf8");
 assert.match(bridge,/connectorStore\.update/);
 assert.match(bridge,/JARVIS_N8N_BRIDGE_SECRET/);
 assert.match(script,/Invoke-RestMethod/);
 assert.match(script,/127\.0\.0\.1:5678/);
 assert.doesNotMatch(script,/docker run|listen|portproxy/);
});
