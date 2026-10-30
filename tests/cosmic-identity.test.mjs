import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
const source = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(
  ts.transpileModule(source("lib/voice/arrival-intent.ts"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports },
);
test("bulletin replay recognizes explicit requests and does not intercept ordinary research", () => {
  for (const text of [
    "Jarvis, repita o boletim",
    "Ouça o boletim",
    "Leia o boletim de hoje",
    "mostre o boletim",
  ])
    assert.equal(exports.arrivalBriefingIntent(text), true, text);
  for (const text of [
    "qual a economia brasileira?",
    "crie um boletim fictício",
    "quais projetos conhece?",
  ])
    assert.equal(exports.arrivalBriefingIntent(text), false, text);
});
test("official cosmic image is the exact owner-supplied asset", () => {
  const data = readFileSync(
    new URL("../public/cosmic/star-orbiting-black-hole.jpg", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    "e3a37da394870d8072782e15f8042943729cd199ad69b152427b0a564a42b7b8",
  );
  assert.match(
    source("app/components/JarvisExperience.tsx"),
    /from "\.\/CosmicScene"/,
  );
  assert.doesNotMatch(
    source("app/components/JarvisExperience.tsx"),
    /from "\.\/HolographicCore"/,
  );
});
test("arrival uses the authenticated existing endpoint, no chat persistence or new audio service", () => {
  const s = source("app/components/ArrivalBriefing.tsx");
  assert.match(s, /\/api\/director\/arrival-briefing/);
  assert.match(s, /getVoiceManager\(\)\.speak/);
  assert.doesNotMatch(s, /setMessages|localStorage|\/api\/voice/);
  assert.match(s, /controller\.signal/);
  assert.match(
    source("app/api/director/arrival-briefing/route.ts"),
    /await authorized\(\)/,
  );
});
test("briefing distinguishes stale verification, unavailable figures and unknown evolution", async () => {
  const moduleExports = {};
  const requests = [];
  vm.runInNewContext(
    ts.transpileModule(source("lib/connectors/arrival-briefing.ts"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: moduleExports,
      require: () => ({}),
      Intl,
      Date,
      AbortSignal,
      fetch: async (url) => {
        requests.push(url);
        return {
          ok: true,
          json: async () =>
            url.includes("sgs.432/")
              ? [{ data: "29/10/2026", valor: "12.50" }]
              : [{ data: "inválida", valor: "0" }],
        };
      },
    },
  );
  const result = await moduleExports.arrivalBriefing({
    configured: () => true,
    read: async () => ({
      connections: {
        github: { status: "connected", verifiedAt: "2026-10-28" },
      },
      audit: [],
    }),
  });
  assert.match(result.text, /última verificação 2026-10-28/);
  assert.match(result.text, /12,50%.*referência 29\/10\/2026/);
  assert.match(result.text, /IPCA mensal: dado não confirmado/);
  assert.doesNotMatch(result.text, /IPCA mensal: 0%/);
  assert.match(result.text, /Não tenho eventos recentes suficientes/);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((url) => url.startsWith("https://api.bcb.gov.br/")));
});
