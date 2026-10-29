import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../lib/codex/task-store.ts",import.meta.url),"utf8");
test("Codex tasks persist via encrypted CAS vault, not a process-local map",()=>{
  assert.match(source,/connectorStore\.update/);
  assert.match(source,/connectorStore\.read/);
  assert.match(source,/transitionCodexTask\(/);
  assert.match(source,/TASK_NOT_FOUND/);
  assert.match(source,/TASK_LIMIT/);
  assert.doesNotMatch(source,/localStorage|globalThis|new Map\(/);
});
test("Persistent task creation rejects production branches",()=>{
  assert.match(source, /\["main","master"\]/);
  assert.match(source,/INVALID_SCOPE/);
});

test("Persistent task record contains the actual Codex instruction and kind",()=>{
  assert.match(source,/kind:input\.kind,instruction:input\.instruction\.trim\(\)/);
  assert.match(source,/input\.instruction\.length > 1500/);
  assert.match(source,/\["review", "test", "implement"\]\.includes\(input\.kind\)/);
});
