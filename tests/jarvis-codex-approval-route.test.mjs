import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../app/api/director/codex/approve/route.ts",import.meta.url),"utf8");
test("Codex approval requires user authentication, same origin and exact task affirmation",()=>{
 assert.match(src,/await authorized\(\)/);
 assert.match(src,/sec-fetch-site/);
 assert.match(src,/v\.confirmation!=="autorizo esta tarefa"/);
 assert.match(src,/task\.state!=="draft"/);
 assert.match(src,/task\.repository!=="kiroaventureiro\/jarvis-kiro-"/);
 assert.match(src,/approvalVerified:true/);
});
test("Approval endpoint never dispatches jobs or suggests task execution",()=>{
 assert.match(src,/started:false,queued:false/);
 assert.match(src,/Nenhuma execução foi iniciada/);
 assert.doesNotMatch(src,/spawn\(|exec\(|providerCall\(/);
});
