import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Jarvis personality configuration is valid and explicit", () => {
  const p = JSON.parse(
    fs.readFileSync("config/jarvis-personality.json", "utf8"),
  );
  assert.equal(p.identity.name, "Jarvis Kiro");
  assert.equal(p.identity.language, "pt-BR");
  assert.ok(p.authority.approvalRequired.some((x) => x.includes("produção")));
});
test("integration catalog cannot claim unverified active connections", () => {
  const c = JSON.parse(
    fs.readFileSync("config/integration-catalog.json", "utf8"),
  );
  assert.ok(c.connections.length >= 6);
  const loader = fs.readFileSync("lib/jarvis-profile.ts", "utf8");
  assert.match(loader, /operationalSnapshot/);
  assert.match(loader, /verified/);
  assert.doesNotMatch(loader, /connected:\s*false/);
});
test("profile endpoint requires owner session", () => {
  const src = fs.readFileSync("app/api/director/profile/route.ts", "utf8");
  assert.match(src, /await authorized\(\)/);
  assert.match(src, /status:\s*401/);
  assert.match(src, /Cache-Control["']:\s*["']no-store/);
});

test("operational persona is global rather than bound to a single integration", () => {
  const p = JSON.parse(fs.readFileSync("config/jarvis-personality.json", "utf8"));
  assert.ok(p.version >= 2);
  assert.ok(p.interaction.operationalCycle.length >= 6);
  assert.match(p.interaction.scope, /qualquer conector atual ou futuro/);
  for (const key of ["completed", "partial", "failed", "blocked", "uncertain"]) {
    assert.ok(p.interaction.responseContract[key]);
  }
  assert.match(p.principles.join(" "), /independente do serviço/);
});
