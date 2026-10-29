import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync(new URL("../app/api/director/codex/dispatch/route.ts",import.meta.url),"utf8");
test("Codex dispatch is authenticated, same origin, scoped, and never claims work started",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/sec-fetch-site/);
 assert.match(route,/task\.state!=="approved"/);
 assert.match(route,/!readiness\.canStartTasks\|\|!readiness\.workerAuthenticated/);
 assert.match(route,/started:false,queued:false/);
 assert.doesNotMatch(route,/spawn\(|exec\(|worker\.start\(/);
});
