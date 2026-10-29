import test from "node:test";
import assert from "node:assert/strict";
import {diagnoseCodexCloud} from "../scripts/codex-cloud-diagnostic.mjs";

function runner(last) {
  const calls=[];
  return {calls,run:async (file,args,options)=>{
    calls.push(args);
    assert.equal(file,"codex");
    assert.equal(options.shell,false);
    assert.equal(options.timeout,15000);
    if (args[0]==="--version") return {stdout:"codex-cli 0.163.0\n"};
    if (args[1]==="--help") return {stdout:"exec list status diff apply"};
    return last();
  }};
}
test("Diagnostic uses only read commands and does not expose rejected authentication output",async()=>{
  const r=runner(()=>{throw {stderr:"401 Unauthorized private-token-secret-value"};});
  const report=await diagnoseCodexCloud({run:r.run,env:{JARVIS_SESSION_SECRET:"private-token-secret-value"}});
  assert.equal(report.cloudAuthentication,"rejected");
  assert.equal(report.blocker,"cloud_authentication_rejected");
  assert.equal(report.taskCreationVerified,false);
  assert.equal(JSON.stringify(report).includes("private-token-secret-value"),false);
  assert.deepEqual(r.calls,[["--version"],["cloud","--help"],["cloud","list","--json","--limit","1"]]);
});
test("A successful list proves read access, never task creation or Jarvis connectivity",async()=>{
  const r=runner(()=>({stdout:JSON.stringify({tasks:[]})}));
  const report=await diagnoseCodexCloud({run:r.run,env:{}});
  assert.equal(report.cloudAuthentication,"read_verified");
  assert.equal(report.taskCreationVerified,false);
  assert.equal(report.jarvisExecutorConnected,false);
});
test("Unexpected response and timeout do not establish authentication",async()=>{
  for(const last of [()=>({stdout:'{"error":"no access"}'}),()=>{throw {killed:true};}]) {
    const r=runner(last), report=await diagnoseCodexCloud({run:r.run,env:{}});
    assert.equal(report.cloudAuthentication,"not_verified");
  }
});

test("Transport failures never claim rejected authentication or disclose raw errors",async()=>{
  for (const detail of ["error sending request for url private-token-secret-value", "Failed to connect to proxy port 8080", "ECONNREFUSED", "ENOTFOUND", "certificate verify failed"]) {
    const r=runner(()=>{throw {message:detail};});
    const report=await diagnoseCodexCloud({run:r.run,env:{}});
    assert.equal(report.cloudAuthentication,"not_verified");
    assert.equal(report.blocker,"cloud_transport_failed");
    assert.equal(report.taskCreationVerified,false);
    assert.equal(report.jarvisExecutorConnected,false);
    assert.equal(JSON.stringify(report).includes(detail),false);
  }
});

test("Timeout takes precedence over transport wording; explicit rejection stays distinct",async()=>{
  for (const [error,authentication,blocker] of [
    [{killed:true,message:"error sending request"},"not_verified","cloud_probe_timeout"],
    [{stderr:"403 Forbidden"},"denied","cloud_access_denied"],
    [{message:"unexpected CLI failure"},"not_verified","cloud_probe_failed"],
  ]) {
    const r=runner(()=>{throw error;});
    const report=await diagnoseCodexCloud({run:r.run,env:{}});
    assert.equal(report.cloudAuthentication,authentication);
    assert.equal(report.blocker,blocker);
  }
});
