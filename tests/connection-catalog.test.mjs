import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("config/connection-catalog.json", "utf8"));
const api = readFileSync("app/api/director/connections/route.ts", "utf8");
const ui = readFileSync("app/conexoes/page.tsx", "utf8");
test("catalog covers social media, voice, video and automation without claiming connectivity", () => {
  assert.ok(c.items.length >= 90);
  for (const category of [
    "Redes sociais",
    "Voz e áudio",
    "Vídeo e edição",
    "Automação e comunicação",
  ])
    assert.ok(c.items.some((x) => x.category === category));
  assert.ok(
    c.items.every(
      (x) =>
        x.status === "not_connected" &&
        x.requiresAuthorization &&
        x.automaticSpending === false,
    ),
  );
});
test("catalog endpoint is authenticated and no secrets are collected", () => {
  assert.match(api, /await authorized\(\)/);
  assert.match(ui, /disabled\s+title=/);
  assert.doesNotMatch(ui, /type="password"/);
});
