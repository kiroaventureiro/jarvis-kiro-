import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const ui = fs.readFileSync("app/components/JarvisExperience.tsx", "utf8");
test("typed chat retains RouteLLM and attachment routing without creating Realtime calls", () => {
  const send = ui.slice(
    ui.indexOf("async function send("),
    ui.indexOf("function toggleAudio()"),
  );
  assert.match(send, /fetch\(["']\/api\/director\/abacus["']/);
  assert.doesNotMatch(send, /await start\(false\)/);
  assert.match(send, /workspace\.analyze\(text\)/);
  assert.match(
    send,
    /appendTranscript\(\s*items,\s*assistantId,\s*["']assistant["']/,
  );
});
