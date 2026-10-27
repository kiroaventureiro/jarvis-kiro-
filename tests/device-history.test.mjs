import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync("lib/device-history.ts","utf8"),hud=fs.readFileSync("app/components/JarvisExperience.tsx","utf8");
test("on-device history is explicit opt-in with bounded retention and erasure",()=>{
 assert.match(source,/if\(!historyConsent\(\)\)return/);
 assert.match(source,/MAX_ITEMS=16,MAX_TEXT=600,TTL=7\*24\*60\*60\*1000/);
 assert.match(source,/localStorage\.removeItem\(KEY\)/);
 assert.match(hud,/Guardar neste dispositivo/);
 assert.match(hud,/setHistoryConsent\(next\)/);
});
test("history never creates a new external request",()=>assert.doesNotMatch(source,/fetch\(|XMLHttpRequest/));
