import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const wake=fs.readFileSync("app/components/WakeListener.tsx","utf8");
const hud=fs.readFileSync("app/components/JarvisExperience.tsx","utf8");
test("wake listener waits for spoken Jarvis and supports explicit stop",()=>{
 assert.match(wake,/const wake=/);
 assert.match(wake,/wake\.test\(transcript\)/);
 assert.match(wake,/enabledRef\.current=false/);
 assert.match(wake,/onClick=\{activate\}/);
});
test("spoken requests reach Abacus using an authenticated same-origin call",()=>{
 assert.match(hud,/<WakeListener/);
 assert.match(hud,/fetch\("\/api\/director\/abacus"/);
 assert.match(hud,/credentials:"same-origin"/);
});
