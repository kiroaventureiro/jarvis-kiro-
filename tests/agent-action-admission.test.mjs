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

test("a boolean approval never authorizes a write operation", () => {
 const decision=admitJarvisAction({action:"publish",resource:"site",ownerId:"owner1",verifiedConnection:true,approved:true});
 assert.equal(decision.allowed,false);
});
test("preflight requires action/resource/owner match and an unconsumed, future approval", () => {
 const now=Date.parse("2026-10-31T02:00:00.000Z");
 const proof={action:"publish",resource:"site",ownerId:"owner1",expiresAt:"2026-10-31T02:05:00.000Z",consumed:false,serverVerified:true};
 const request={action:"publish",resource:"site",ownerId:"owner1",verifiedConnection:true,approvalEvidence:proof};
 assert.equal(admitJarvisAction(request,now).allowed,true);
 assert.equal(admitJarvisAction({...request,resource:"other"},now).allowed,false);
 assert.equal(admitJarvisAction({...request,ownerId:"owner2"},now).allowed,false);
 assert.equal(admitJarvisAction({...request,action:"delete_data"},now).allowed,false);
 assert.equal(admitJarvisAction({...request,approvalEvidence:{...proof,consumed:true}},now).allowed,false);
 assert.equal(admitJarvisAction({...request,approvalEvidence:{...proof,serverVerified:false}},now).allowed,false);
 assert.equal(admitJarvisAction(request,Date.parse("2026-10-31T02:06:00.000Z")).allowed,false);
});
