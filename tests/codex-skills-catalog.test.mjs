import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code=ts.transpileModule(fs.readFileSync("lib/cognitive/codex-skill-catalog.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const { CODEX_SKILLS, CODEX_SKILL_SOURCE, selectCodexSkills, codexSkillsGuidance }=
 await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));

test("Jarvis publishes exact catalog of the 20 Codex skills (11+4+5)",()=>{
 assert.equal(CODEX_SKILLS.length,20);
 assert.equal(new Set(CODEX_SKILLS.map(s=>s.id)).size,20);
 assert.deepEqual(Object.fromEntries(["developer-essentials","javascript-typescript","security-scanning"]
 .map(name=>[name,CODEX_SKILLS.filter(s=>s.group===name).length])),
 {"developer-essentials":11,"javascript-typescript":4,"security-scanning":5});
 assert.equal(CODEX_SKILL_SOURCE.repository,"wshobson/agents");
 for(const skill of CODEX_SKILLS){
  assert.match(skill.id,/^[a-z][a-z0-9-]+$/);
  assert.ok(skill.guidance.length>40);
 }
});
test("Jarvis selects skills only for relevant engineering contexts",()=>{
 assert.deepEqual(selectCodexSkills("O que vamos comer hoje?"),[]);
 assert.deepEqual(selectCodexSkills("Como está meu dia?"),[]);
 assert.ok(selectCodexSkills("Revise os testes Jest da API JavaScript").length<=2);
 assert.ok(selectCodexSkills("Depure esse erro no Node.js").some(s=>s.id==="error-handling-patterns"||s.id==="debugging-strategies"));
 assert.match(codexSkillsGuidance("Revise o código TypeScript e segurança"),/SKILLS DO CODEX/);
 assert.match(codexSkillsGuidance("Como está o trânsito?"),/^$/);
});
test("skills are part of shared Jarvis protocol and cannot grant new permissions",()=>{
 const protocol=fs.readFileSync("lib/cognitive/protocol.ts","utf8");
 assert.match(protocol,/codexSkillsGuidance\(message\)/);
 const api=fs.readFileSync("app/api/director/local-skills/route.ts","utf8");
 assert.match(api,/export async function GET/);
 assert.match(api,/await authorized\(\)/);
 assert.match(api,/independentExecution:false/);
});
