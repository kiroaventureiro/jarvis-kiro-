import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../lib/agents/job-transitions.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const { transitionJarvisJob } = module.exports;
test("supports scheduled job lifecycle", () => {
 assert.deepEqual(transitionJarvisJob("queued","start"), {accepted:true,state:"running",reason:"allowed"});
 assert.equal(transitionJarvisJob("running","complete").state,"completed");
});
test("failed tasks can retry but completed or cancelled tasks cannot", () => {
 assert.equal(transitionJarvisJob("failed","retry").state,"queued");
 assert.equal(transitionJarvisJob("completed","retry").accepted,false);
 assert.equal(transitionJarvisJob("cancelled","start").accepted,false);
});
test("invalid or repeated events never silently succeed", () => {
 assert.equal(transitionJarvisJob("running","start").accepted,false);
 assert.equal(transitionJarvisJob("queued","complete").accepted,false);
 assert.equal(transitionJarvisJob("queued","hack").accepted,false);
});
