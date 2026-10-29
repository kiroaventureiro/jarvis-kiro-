import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../app/api/director/codex/tasks/[id]/route.ts",import.meta.url),"utf8");
test("Codex task status is authenticated, read-only and not executable",()=>{
  assert.match(source,/await authorized\(\)/);
  assert.match(source,/getCodexTask\(id\)/);
  assert.match(source,/executorConnected:false/);
  assert.match(source,/private, no-store/);
  assert.doesNotMatch(source,/export async function POST|export async function PATCH|spawn\(/);
});

test("Nested route resolves server modules from the repository root",()=>{
  assert.match(source,/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/auth/);
  assert.match(source,/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/codex\/task-store/);
});

test("Codex status API returns a view model with truthful state",()=>{
 assert.match(source,/jarvisResultView\(result\)/);
 assert.match(source,/task\.state === "cancelled"/);
 assert.match(source,/task\.state === "approved"/);
 assert.match(source,/executorConnected:false/);
});
