import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const src=readFileSync(new URL("../lib/orchestration/artifact-access.ts",import.meta.url),"utf8");
const exp={};
vm.runInNewContext(ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp});
test("Jarvis artifact access rejects unsafe identifiers",()=>{
 assert.equal(exp.validJarvisArtifactId("abcDEF1234567890"),true);
 assert.equal(exp.validJarvisArtifactId("../../private"),false);
 assert.equal(exp.validJarvisArtifactId("short"),false);
});
test("Artifact endpoint fails closed without storage and checks session",()=>{
 const route=readFileSync(new URL("../app/api/director/artifacts/[id]/route.ts",import.meta.url),"utf8");
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/status:503/);
 assert.match(route,/validJarvisArtifactId\(id\)/);
 assert.doesNotMatch(route,/readFile|createReadStream|redirect\(/);
});

test("Nested artifact route resolves both protected server modules",()=>{
 const route=readFileSync(new URL("../app/api/director/artifacts/[id]/route.ts",import.meta.url),"utf8");
 assert.match(route,/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/auth/);
 assert.match(route,/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/lib\/orchestration\/artifact-access/);
});
