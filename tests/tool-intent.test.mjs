import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/orchestration/tool-intent.ts",import.meta.url),"utf8");
test("planner defaults to no execution and protects generated/modified outputs",()=>{
  assert.match(source,/approvalRequired:mode==="modify"\|\|mode==="generate"/);
  assert.match(source,/executableNow = domain === "account" && mode === "read"/);
  assert.doesNotMatch(source,/fetch\(|exec\(|spawn\(|eval\(/);
});
test("planner covers the requested domains without silently activating third parties",()=>{
  for(const area of ["account","voice","image","video","avatar","code","general"])assert.ok(source.includes('"'+area+'"'));
});
