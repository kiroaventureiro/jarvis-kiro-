import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route=readFileSync("app/api/voice/route.ts","utf8");

test("voice instructions use versioned Jarvis personality",()=>{
 assert.match(route,/getJarvisProfile\(\)/);
 assert.match(route,/getIntegrationStatus\(\)/);
 assert.match(route,/instructions: buildVoiceInstructions\(\)/);
});
test("realtime voice remains session-authorized and promises no unconnected actions",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/NÃO recebeu ferramentas externas/);
 assert.match(route,/Não afirme que conectou/);
 assert.match(route,/approvalRequired/);
});
