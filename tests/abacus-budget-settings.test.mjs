import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const component=readFileSync("app/components/AbacusBudgetSettings.tsx","utf8");
const settings=readFileSync("app/configuracoes/page.tsx","utf8");
test("Abacus budget inspection is GET only and opt-in",()=>{
 assert.match(component,/onClick=\{check\}/);
 assert.match(component,/fetch\("\/api\/director\/abacus"/);
 assert.doesNotMatch(component,/method:\s*["']POST/);
 assert.match(component,/Créditos reais disponíveis: não consultados/);
 assert.match(settings,/<AbacusBudgetSettings/);
});
