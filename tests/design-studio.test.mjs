import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const cache = new Map();
async function loadUrl(file) {
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  for (const m of [...code.matchAll(/from\s+(["'])(\.\.?\/[^"']+)\1/g)])
    code = code.replace(
      m[0],
      "from " +
        JSON.stringify(
          await loadUrl(path.resolve(path.dirname(file), m[2] + ".ts")),
        ),
    );
  const u =
    "data:text/javascript;base64," + Buffer.from(code).toString("base64");
  cache.set(file, u);
  return u;
}
const load = (p) => loadUrl(path.resolve(p)).then((u) => import(u));
const {
  normalizeDesign,
  designFromBrief,
  extractDesign,
  designFiles,
  previewDocument,
  parseVisionDesign,
} = await load("lib/design/core.ts");
const { designZip } = await load("lib/design/archive.ts");
const { designImageRequest } = await load("lib/design/request.ts");
const { answerDesignRequest, designIntent } = await load(
  "lib/design/intent.ts",
);
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
test("Brief produces editable regions and separate offline files", () => {
  const s = designFromBrief("Kiro Studio\nApresentação\nProjetos\nContato"),
    f = designFiles(s);
  assert.equal(s.sections.length, 3);
  assert.match(f["index.html"], /Kiro Studio/);
  assert.match(f["index.html"], /assets\/styles.css/);
  assert.ok(!f["index.html"].includes("<style>"));
  assert.match(f["wireframe.txt"], /\[h2: Projetos\]/);
  assert.match(previewDocument(f), /style-src 'unsafe-inline'/);
  assert.ok(!f["index.html"].includes("<script"));
});
test("Model output cannot inject HTML, scripts, CSS URLs or unknown region classes", () => {
  const s = normalizeDesign({
    title: "<img src=x onerror=alert(1)>",
    background: "red; background:url(https://evil.test)",
    font: "url(evil)",
    sections: [
      {
        title: "</h2><script>alert(1)</script>",
        text: "<iframe src=https://evil.test>",
        kind: 'evil onclick="x"',
      },
    ],
  });
  const f = designFiles(s);
  assert.equal(s.background, "#07121f");
  assert.equal(s.font, "sans-serif");
  assert.equal(s.sections[0].kind, "content");
  assert.ok(!f["index.html"].includes("<script>"));
  assert.ok(!f["index.html"].includes("<iframe"));
  assert.ok(!f["assets/styles.css"].includes("url("));
});
test("Extraction keeps observed CSS variables and ignores executable source without fetching", () => {
  const e = extractDesign(
    "<title>Studio</title><script><h1>INJECTED</h1></script><h1>Kiro</h1><h2>Projetos</h2><style>:root{--brand:#abcdef;} .hero{background:#07121f}</style>",
    ":root{--radius:12px;} .card{color:#e8f4ff}",
  );
  assert.equal(e.spec.title, "Kiro");
  assert.equal(e.spec.sections.length, 2);
  assert.equal(e.tokens["--brand"], "#abcdef");
  assert.ok(!JSON.stringify(e).includes("INJECTED"));
  assert.throws(() => extractDesign("x".repeat(500001), ""));
  assert.ok(e.limitations.length);
});
test("Image analysis requires explicit consent and a genuine image signature", () => {
  assert.throws(() => designImageRequest({ image: png }));
  assert.throws(() =>
    designImageRequest({
      approved: true,
      image: "data:image/png;base64,PHNjcmlwdD4=",
    }),
  );
  assert.throws(() =>
    designImageRequest({ approved: true, image: png, key: "secret" }),
  );
  assert.equal(
    designImageRequest({ approved: true, image: png }).model,
    "route-llm",
  );
});
test("Malformed or truncated vision output fails without fabricated analysis", () => {
  assert.throws(() => parseVisionDesign('{"title":"Kiro"'));
  assert.throws(() => parseVisionDesign('{"sections":[]}'));
  assert.equal(
    parseVisionDesign('```json\n{"sections":[{"title":"Kiro"}]}\n```').source,
    "image",
  );
});
test("ZIP has UTF8 local entries, directory offsets and no traversal", () => {
  const f = designFiles(designFromBrief("Kiro\nAção")),
    zip = designZip(f),
    v = new DataView(zip.buffer);
  assert.equal(v.getUint32(0, true), 0x04034b50);
  assert.equal(v.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(zip.length - 12, true), Object.keys(f).length);
  const central = v.getUint32(zip.length - 6, true);
  assert.equal(v.getUint32(central, true), 0x02014b50);
  assert.throws(() => designZip({ "../evil": "x" }));
  assert.throws(() => designZip({ "/evil": "x" }));
});
test("Text and voice route interface requests to the native studio without a paid call", () => {
  for (const m of [
    "Crie uma interface a partir desta imagem",
    "Extraia o design system",
    "to-wireframe",
  ]) {
    assert.equal(designIntent(m), true);
    assert.equal(answerDesignRequest(m).visual.modules[0].href, "/criador");
    assert.equal(answerDesignRequest(m).usage, null);
  }
  assert.equal(answerDesignRequest("Qual o saldo da Abacus?"), null);
});

test("Sandbox preview anchors stay in srcdoc while exported files keep relative navigation",()=>{
 const files=designFiles(designFromBrief("Kiro\nProjetos\nContato"));
 assert.match(files["index.html"],/href="#section-0"/);
 assert.match(previewDocument(files),/href="about:srcdoc#section-0"/);
 assert.ok(!previewDocument(files).includes('href="#'));
});
