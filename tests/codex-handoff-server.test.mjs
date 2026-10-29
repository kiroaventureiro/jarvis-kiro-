import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../lib/codex/handoff-server.ts",import.meta.url),"utf8");
test("Codex handoff is disabled by default and requires an independent approval verdict",()=>{
  assert.match(source,/JARVIS_CODEX_WORKER_ENABLED/);
  assert.match(source,/!== "true"/);
  assert.match(source,/approvalVerified: args\.approvalVerified/);
  assert.match(source,/claimNonce: claimCodexNonce/);
  assert.match(source,/acceptCodexWorkerEnvelope/);
  assert.doesNotMatch(source,/spawn\(|exec\(|fetch\(/);
});
