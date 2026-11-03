import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("lib/cognitive/codex-agent-roles.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {CODEX_AGENT_ROLES,CODEX_AGENT_SOURCE,selectCodexAgents,codexAgentGuidance}=
 await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
test("four agent profiles match pinned Codex plugin sources",()=>{
 assert.deepEqual(CODEX_AGENT_ROLES.map(x=>x.id),["monorepo-architect","javascript-pro","typescript-pro","threat-modeling-expert"]);
 assert.equal(CODEX_AGENT_SOURCE.repository,"wshobson/agents");
 assert.ok(CODEX_AGENT_ROLES.every(x=>x.sourcePath.startsWith("plugins/")&&x.instructions.length>70));
});
test("delegation is relevant, bounded and never enabled for everyday non-engineering topics",()=>{
 assert.deepEqual(selectCodexAgents("Como foi meu dia hoje?"),[]);
 assert.deepEqual(selectCodexAgents("Prepare um roteiro de vídeo"),[]);
 assert.ok(selectCodexAgents("Preciso depurar async JavaScript").some(x=>x.id==="javascript-pro"));
 assert.ok(selectCodexAgents("Revisar TypeScript e tsconfig").some(x=>x.id==="typescript-pro"));
 assert.ok(selectCodexAgents("Modelar ameaças STRIDE no sistema").some(x=>x.id==="threat-modeling-expert"));
 assert.ok(selectCodexAgents("Melhorar monorepo Nx").some(x=>x.id==="monorepo-architect"));
 assert.ok(selectCodexAgents("TypeScript JavaScript monorepo",2).length<=2);
 assert.match(codexAgentGuidance("Revisar TypeScript"),/sem execução independente/);
});
test("Jarvis routes specialist roles through shared cognitive protocol and authenticated skills inventory",()=>{
 const p=fs.readFileSync("lib/cognitive/protocol.ts","utf8");
 const a=fs.readFileSync("app/api/director/local-skills/route.ts","utf8");
 assert.match(p,/codexAgentGuidance\(message\)/);
 assert.match(a,/specialistAgents:CODEX_AGENT_ROLES/);
 assert.match(a,/independentExecution:false/);
 assert.match(a,/await authorized\(\)/);
});
