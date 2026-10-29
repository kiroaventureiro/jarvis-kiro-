import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const plan=readFileSync(new URL("../lib/codex/delegation-plan.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../app/api/director/codex/route.ts",import.meta.url),"utf8");
test("Codex draft endpoint is authenticated, origin-bound and non-executing",()=>{
  assert.match(route,/await authorized\(\)/);
  assert.match(route,/sec-fetch-site/);
  assert.match(route,/planCodexDelegation\(/);
  assert.match(route,/queued:false, started:false/);
  assert.doesNotMatch(route,/exec\(|spawn\(|fetch\(/);
});
test("Delegation contract rejects main/master and requires separate approval",()=>{
  assert.match(plan,/input\.branch === "main"/);
  assert.match(plan,/input\.branch === "master"/);
  assert.match(plan,/requiresApproval: true/);
  assert.match(plan,/executionStarted: false/);
  assert.match(plan,/productionAllowed: false/);
});
