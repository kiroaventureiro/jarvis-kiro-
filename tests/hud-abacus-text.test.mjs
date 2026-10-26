import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ui=fs.readFileSync("app/components/JarvisExperience.tsx","utf8");
test("typed chat routes to Abacus rather than opening a realtime voice session",()=>{
 const send=ui.slice(ui.indexOf("async function send("),ui.indexOf("function toggleAudio()"));
 assert.ok(send.includes('fetch("/api/director/abacus"'));
 assert.ok(!send.includes("await start(false)"));
 assert.ok(send.includes("workspace.analyze(text)"));
 assert.ok(send.includes('role:"assistant"'));
});
