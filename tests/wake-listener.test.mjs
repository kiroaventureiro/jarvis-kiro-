import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const wake = fs.readFileSync("app/components/WakeListener.tsx", "utf8");
const hud = fs.readFileSync("app/components/JarvisExperience.tsx", "utf8");
test("wake listener delegates lifecycle to a controller and requires initial consent", () => {
  assert.match(wake, /new VoiceController/);
  assert.match(wake, /setConsent\(true\)/);
  assert.match(wake, /Ativar escuta/);
  assert.match(wake, /controller\.stop\(/);
  assert.match(wake, /visibilitychange/);
});
test("spoken requests retain authenticated same-origin routing", () => {
  assert.match(hud, /<WakeListener/);
  assert.match(hud, /fetch\(["']\/api\/director\/abacus["']/);
  assert.match(hud, /credentials:\s*["']same-origin["']/);
});
