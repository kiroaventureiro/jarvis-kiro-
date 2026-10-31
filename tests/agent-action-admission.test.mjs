import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../lib/agents/action-admission.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
new Function("module", "exports", js)(module, module.exports);
const { admitJarvisAction } = module.exports;
test("read operations require a verified connection", () => {
 assert.equal(admitJarvisAction({action:"read_project",resource:"kiro"}).allowed,false);
 assert.equal(admitJarvisAction({action:"read_project",resource:"kiro",verifiedConnection:true}).allowed,true);
});
test("write, deletion and publishing require explicit approval", () => {
 for (const action of ["edit_code","publish","delete_data","send_message"]) {
  const pending=admitJarvisAction({action,resource:"kiro",verifiedConnection:true});
  assert.equal(pending.allowed,false);
  assert.equal(pending.requiresApproval,true);
 }
});
test("unverified connections never gain permission from approval alone", () => {
 assert.equal(admitJarvisAction({action:"publish",resource:"kiro",approved:true}).allowed,false);
});
test("invalid and unknown actions fail closed", () => {
 assert.equal(admitJarvisAction({action:"arbitrary_command",resource:"kiro",verifiedConnection:true,approved:true}).allowed,false);
 assert.equal(admitJarvisAction({action:"inspect_status",resource:"",verifiedConnection:true}).allowed,false);
});
