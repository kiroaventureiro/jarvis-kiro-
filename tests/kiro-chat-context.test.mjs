import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const src=fs.readFileSync("lib/kiro-context-for-chat.ts","utf8");
const protocol=fs.readFileSync("lib/abacus/protocol.ts","utf8");
const registry=JSON.parse(fs.readFileSync("config/kiro-project-registry.json","utf8"));
test("KIRO project context is sourced from existing registry, not invented",()=>{
 assert.ok(registry.projects.length>2);
 assert.match(src,/registry\.projects/);
 assert.match(src,/NÃO são conexões nem estados operacionais ao vivo/);
 assert.match(protocol,/kiroChatContext\(message\)/);
});
test("context is scoped to KIRO questions and contains no secrets",()=>{
 assert.match(src,/trigger\.test\(message\)/);
 assert.doesNotMatch(src,/process\.env|fetch\(/);
});
