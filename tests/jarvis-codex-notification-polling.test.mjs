import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
test("Only tracked authenticated Codex tasks generate conversational alerts",()=>{
 assert.match(ui,/trackedCodexIds/);
 assert.match(ui,/data\.alert\.source!=="codex"/);
 assert.match(ui,/data\.alert\.subjectId!==id/);
 assert.match(ui,/seenCodexAlerts\.current\.has\(alert\.id\)/);
 assert.match(ui,/window\.clearInterval\(timer\)/);
 assert.match(ui,/document\.hidden/);
});
test("Drafts are tracked but never announced as completed",()=>{
 assert.match(ui,/data\.task\.state\s*!==\s*"draft"/);
 assert.match(ui,/setTrackedCodexIds\(/);
 assert.match(ui,/alert\.kind==="completed"/);
});
