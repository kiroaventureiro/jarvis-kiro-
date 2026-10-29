import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../app/api/director/capabilities/route.ts",import.meta.url),"utf8");
test("Capabilities require authenticated session and expose no secrets",()=>{
 assert.match(code,/await authorized\(\)/);
 assert.match(code,/status:401/);
 assert.match(code,/Cache-Control/);
 assert.doesNotMatch(code,/OPENAI_API_KEY\s*[,}]/);
 assert.doesNotMatch(code,/askNavi\(|createCodexTask\(/);
});
test("Codex execution and Windows device capabilities are derived from verified readiness",()=>{
 assert.match(code,/codexWorkerReadiness\(\)/);
 assert.match(code,/companionStatus/);
 assert.match(code,/billingApproved/);
});
