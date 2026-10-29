import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  fs.readFileSync("lib/orchestration/council.ts", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { runCouncil, councilQuestion } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("Council is opt-in and disabled mode never admits or calls a provider", async () => {
  const r = await runCouncil("Decida", {
    enabled: false,
    admit: () => {
      throw Error("forbidden");
    },
    ask: () => {
      throw Error("forbidden");
    },
  });
  assert.equal(r.state, "disabled");
  assert.equal(r.completedCalls, 0);
});
test("Council collects two perspectives, reviews anonymized candidates, then synthesizes", async () => {
  const calls = [];
  const r = await runCouncil("Qual opção é mais eficiente?", {
    enabled: true,
    admit: () => true,
    ask: async (prompt) => {
      calls.push(prompt);
      return { text: "Parecer " + calls.length, model: "route-llm" };
    },
  });
  assert.equal(r.state, "completed");
  assert.equal(calls.length, 5);
  assert.equal(r.completedCalls, 5);
  assert.equal(r.text, "Parecer 5");
  assert.ok(!calls[1].includes("Parecer 1"));
  assert.match(calls[2], /"A":"Parecer 1"/);
  assert.match(calls[2], /"B":"Parecer 2"/);
  assert.match(calls[4], /revisaoA/);
  assert.equal(r.independentModelsVerified, false);
});
test("failure and budget exhaustion stop the sequence without retry or invented consensus", async () => {
  for (const fail of ["provider", "budget"]) {
    let n = 0,
      admitted = 0;
    const r = await runCouncil("Questão", {
      enabled: true,
      admit: () => ++admitted < 4,
      ask: async () => {
        n++;
        if (fail === "provider" && n === 3) throw Error("private");
        return { text: "Parecer", model: "router" };
      },
    });
    assert.equal(r.state, "partial");
    assert.equal(n, 3);
    assert.doesNotMatch(r.text, /private/);
    assert.ok(r.completedCalls < 5);
  }
});
test("cancelled Council stops before the next model call", async () => {
  const controller = new AbortController();
  let n = 0;
  const r = await runCouncil("Questão", {
    enabled: true,
    signal: controller.signal,
    admit: () => true,
    ask: async () => {
      n++;
      controller.abort();
      return { text: "late", model: "router" };
    },
  });
  assert.equal(n, 1);
  assert.equal(r.completedCalls, 0);
  assert.equal(r.state, "partial");
});
test("bounded prompts respect the existing provider input limit even for escaped data", async () => {
  const r = await runCouncil('"'.repeat(490), {
    enabled: true,
    admit: () => true,
    ask: async (prompt) => {
      assert.ok(prompt.length <= 1500);
      return { text: '"'.repeat(2000), model: "router" };
    },
  });
  assert.equal(r.state, "completed");
  assert.equal(
    (
      await runCouncil("x".repeat(501), {
        enabled: true,
        admit: () => false,
        ask: () => {
          throw Error();
        },
      })
    ).state,
    "invalid",
  );
});
test("ordinary questions do not accidentally start a council", () => {
  assert.equal(councilQuestion("Qual seu conselho para este projeto?"), null);
  assert.equal(
    councilQuestion("Jarvis, consulte o conselho: escolha uma arquitetura"),
    "escolha uma arquitetura",
  );
});
