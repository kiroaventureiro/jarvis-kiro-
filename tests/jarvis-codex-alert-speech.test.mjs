import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../app/components/JarvisExperience.tsx",import.meta.url),"utf8");
test("Codex speech alerts require verified alert and quiet, visible, unmuted audio",()=>{
 assert.match(ui,/data\.alert\.source!=="codex"/);
 assert.match(ui,/document\.visibilityState==="visible"/);
 assert.match(ui,/!muteRef\.current/);
 assert.match(ui,/readVoicePreferences\(\)\.volume>0/);
 assert.match(ui,/!getVoiceManager\(\)\.isSpeaking\(\)/);
 assert.match(ui,/!typingAbort\.current/);
 assert.match(ui,/getVoiceManager\(\)\.speak\(alert\.speech/);
});
