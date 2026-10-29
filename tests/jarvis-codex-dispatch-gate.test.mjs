import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync(new URL("../app/api/director/codex/dispatch/route.ts",import.meta.url),"utf8");
test("Codex dispatch is authenticated, same origin, scoped, and never claims work started",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/requestOriginAllowed\(request, process.env.JARVIS_CONNECTOR_ORIGIN, false\)/);
 assert.match(route,/task\.state!=="approved"/);
 assert.match(route,/!readiness\.canStartTasks\|\|!readiness\.workerAuthenticated/);
 assert.match(route,/started:false,queued:false/);
 assert.doesNotMatch(route,/spawn\(|exec\(|worker\.start\(/);
});

test("Dispatch checks the exact permitted repository and development branch",()=>{
 assert.match(route,/task\.repository!=="kiroaventureiro\/jarvis-kiro-"/);
 assert.match(route,/task\.branch!=="feature\/diretor-tecnico-agent"/);
});
