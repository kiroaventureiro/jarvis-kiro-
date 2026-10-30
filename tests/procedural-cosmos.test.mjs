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
test("vertical orbital motion is closed, descends and passes front/back", () => {
  const period = (2 * Math.PI) / exports.ORBIT_SPEED;
  const top = exports.orbitPosition(0);
  const bottom = exports.orbitPosition(period / 2);
  const closed = exports.orbitPosition(period);
  assert.ok(top.y < -2 && bottom.y > 2);
  assert.ok(Math.abs(top.x - closed.x) < 1e-9);
  assert.ok(Math.abs(top.y - closed.y) < 1e-9);
  assert.ok(Math.abs(exports.orbitPosition(period / 4).x) > 1.5);
  assert.notEqual(
    exports.orbitPosition(period / 4).front,
    exports.orbitPosition(period * 0.75).front,
  );
  assert.deepEqual(
    exports.orbitPosition(100, false),
    exports.orbitPosition(0, false),
  );
});
test("comet tail follows prior orbital positions, widens at star and fades", () => {
  const tail = exports.trailSamples(15);
  const star = exports.orbitPosition(15);
  assert.equal(tail.length, 42);
  assert.equal(tail[0].x, star.x);
  assert.equal(tail[0].y, star.y);
  assert.equal(tail[0].width, 1);
  assert.equal(tail[0].alpha, 1);
  assert.equal(tail.at(-1).width, 0);
  assert.equal(tail.at(-1).alpha, 0);
  assert.ok(tail.every((p, i) => i === 0 || (p.width <= tail[i-1].width && p.alpha <= tail[i-1].alpha)));
  assert.ok(Math.hypot(tail[0].x - tail.at(-1).x, tail[0].y - tail.at(-1).y) > 1);
  assert.notDeepEqual(exports.trailSamples(20).map(p => p.x), tail.map(p => p.x));
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
