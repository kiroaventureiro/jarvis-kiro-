import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile = (p) =>
  ts.transpileModule(fs.readFileSync(p, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
const realtime =
  "data:text/javascript;base64," +
  Buffer.from(compile("lib/jarvis-realtime.ts")).toString("base64");
const code = compile("lib/response-presentation.ts")
  .replace('"./jarvis-realtime"', JSON.stringify(realtime))
  .replace("'./jarvis-realtime'", JSON.stringify(realtime));
const { appendSpokenReply, speechUnavailable, visibleResponses } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
test("desktop hides spoken narration but retains visual results and unvoiced text", () => {
  let items = [
    {
      id: "report",
      role: "assistant",
      text: "Relatório pronto",
      presentation: "result",
    },
    { id: "text", role: "assistant", text: "Sem voz" },
    { id: "user", role: "user", text: "Pedido" },
  ];
  items = appendSpokenReply(
    items,
    "spoken",
    "Vou apresentar os resultados.",
    true,
  );
  assert.deepEqual(
    visibleResponses(items, true, false).map((x) => x.id),
    ["report", "text", "user"],
  );
  assert.equal(visibleResponses(items, false, false).length, 4);
  assert.equal(visibleResponses(items, true, true).length, 4);
});
test("failed speech reveals fallback and subsequent transcript chunks preserve speech metadata", () => {
  let items = appendSpokenReply([], "spoken", "Bom ", false);
  items = appendSpokenReply(items, "spoken", "dia", false);
  assert.equal(items[0].text, "Bom dia");
  assert.equal(visibleResponses(items, true, false).length, 0);
  items = speechUnavailable(items, new Set(["spoken"]));
  assert.equal(visibleResponses(items, true, false)[0].text, "Bom dia");
  assert.equal(items[0].speechAvailable, false);
});
