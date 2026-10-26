import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
async function load(path) {
  const source = fs.readFileSync(path, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
}
const registry = await load("lib/integration-registry.ts");
const realtime = await load("lib/jarvis-realtime.ts");
const input = {
  name: "OpenAI",
  category: "ai",
  purpose: "Conversa",
  accountLabel: "Estúdio",
  context: "professional",
  permissions: "Leitura",
};
test("new metadata cannot grant itself verified or authorized access", () => {
  assert.equal(registry.validateConnection(input, "one").state, "planned");
  assert.throws(() =>
    registry.validateConnection({ ...input, state: "verified" }, "two"),
  );
});
test("multiple accounts and large registries remain independent", () => {
  const entries = Array.from({ length: 140 }, (_, i) =>
    registry.validateConnection(
      { ...input, accountLabel: "Conta " + i },
      String(i),
    ),
  );
  const restored = registry.restoreDrafts(JSON.stringify(entries));
  assert.equal(restored.length, 140);
  assert.equal(new Set(restored.map((x) => x.id)).size, 140);
  assert.ok(restored.every((x) => x.state === "planned"));
});
test("corrupted local data and persisted credentials fail closed", () => {
  assert.deepEqual(registry.restoreDrafts("{broken"), []);
  assert.deepEqual(
    registry.restoreDrafts(
      JSON.stringify([
        {
          ...input,
          id: "one",
          state: "verified",
          permissions: "token=secret-value",
        },
      ]),
    ),
    [],
  );
  assert.throws(() =>
    registry.validateConnection(
      { ...input, purpose: "Bearer private-credential" },
      "one",
    ),
  );
});
test("length and context validation reject malformed drafts", () => {
  assert.throws(() =>
    registry.validateConnection({ ...input, context: "admin" }, "one"),
  );
  assert.throws(() =>
    registry.validateConnection({ ...input, name: "x".repeat(81) }, "one"),
  );
  assert.throws(() =>
    registry.validateConnection({ ...input, purpose: "" }, "one"),
  );
});
test("HUD reacts to actual server events, not a timer simulation", () => {
  assert.equal(
    realtime.eventState("input_audio_buffer.speech_started"),
    "listening",
  );
  assert.equal(
    realtime.eventState("input_audio_buffer.speech_stopped"),
    "processing",
  );
  assert.equal(
    realtime.eventState("response.output_audio_transcript.delta"),
    "responding",
  );
  assert.equal(realtime.eventState("output_audio_buffer.stopped"), "idle");
  assert.equal(realtime.eventState("unrecognized"), null);
});
test("streamed answer updates one HUD item while keeping previous history", () => {
  let list = [{ id: "prior", role: "user", text: "Olá" }];
  list = realtime.appendTranscript(list, "answer", "assistant", "Bom");
  list = realtime.appendTranscript(list, "answer", "assistant", " dia");
  assert.equal(list.length, 2);
  assert.equal(list[1].text, "Bom dia");
  list = realtime.appendTranscript(
    list,
    "answer",
    "assistant",
    "Bom dia!",
    true,
  );
  assert.equal(list[1].text, "Bom dia!");
  assert.equal(list[0].text, "Olá");
});
test("private sections remain server authorized and home excludes administrative modules", () => {
  for (const path of ["memoria", "projetos", "controle", "diagnostico"])
    assert.match(
      fs.readFileSync("app/" + path + "/page.tsx", "utf8"),
      /await authorized\(\)/,
    );
  const home = fs.readFileSync("app/page.tsx", "utf8");
  assert.doesNotMatch(home, /DeviceAccess|inventory|readiness|<article/);
  assert.match(
    fs.readFileSync("app/configuracoes/page.tsx", "utf8"),
    /<DeviceAccess/,
  );
});
