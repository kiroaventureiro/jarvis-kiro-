import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
test("Jarvis main chat renders completed replies via the unified panel",()=>{
 assert.match(source,/import \{ JarvisResultPanel \}/);
 assert.match(source,/setUnifiedResults\(previous/);
 assert.match(source,/messageId: assistantId/);
 assert.match(source,/status: "completed"/);
 assert.match(source,/<JarvisResultPanel key=\{entry\.messageId\} result=\{entry\.result\}/);
 assert.match(source,/artifacts: \[\]/);
});

test("Chat does not misattribute Abacus output to Navi",()=>{
 assert.match(source,/source: "other"/);
 assert.doesNotMatch(source,/result\.provider === "openai_navi"/);
});

test("Recent tool output remains attached to earlier messages with bounded memory",()=>{
 assert.match(source,/previous\.slice\(-31\)/);
 assert.match(source,/unifiedResults\.filter\(entry => entry\.messageId === item\.id\)/);
});
