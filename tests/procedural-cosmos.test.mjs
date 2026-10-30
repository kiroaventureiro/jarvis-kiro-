import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const read = (p) =>
  fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const exports = {};
vm.runInNewContext(
  ts.transpileModule(read("lib/hologram/cosmic-canvas.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports },
);
test("orbital motion is continuous, closed and has front/back depth", () => {
  const a = exports.orbitPosition(0),
    b = exports.orbitPosition(Math.PI / 0.075),
    c = exports.orbitPosition((2 * Math.PI) / 0.075);
  assert.ok(Math.abs(a.x - c.x) < 1e-9);
  assert.ok(Math.abs(a.y - c.y) < 1e-9);
  assert.ok(Math.abs(a.x - b.x) > 6);
  assert.notEqual(
    exports.orbitPosition(10).front,
    exports.orbitPosition(60).front,
  );
  assert.deepEqual(
    exports.orbitPosition(100, false),
    exports.orbitPosition(0, false),
  );
});
test("procedural geometry is reproducible and loads no photograph or remote texture", () => {
  const a = exports.seededRandom(73),
    b = exports.seededRandom(73);
  for (let i = 0; i < 50; i++) assert.equal(a(), b());
  assert.doesNotMatch(
    read("lib/hologram/cosmic-canvas.ts"),
    /fetch\(|new Image|\.src\s*=|\.jpg|\.png/,
  );
  assert.doesNotMatch(
    read("app/components/CosmicScene.tsx"),
    /<img|cosmic-tools|CosmicSystems|Restaurar|Entrar no núcleo/,
  );
  assert.doesNotMatch(read("app/cosmic.css"), /url\(/);
});
