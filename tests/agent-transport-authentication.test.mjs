import test from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(){
 const exports={};
 const source=fs.readFileSync("lib/agent-transport-auth.ts","utf8");
 const required=id=>{
  if(id==="server-only")return {};
  if(id==="node:crypto")return {createHmac, timingSafeEqual: (a,b)=>a.length===b.length && a.equals(b)};
  if(id.endsWith("/connectors/server"))return {connectorStore:{}};
  if(id.endsWith("/agent-transport-contract"))return {
   validateAgentMessage:x=>!!x&&x.version===1&&["n8n","windows_agent"].includes(x.source)
    &&typeof x.messageId==="string"&&typeof x.taskId==="string"&&typeof x.summary==="string"
    &&["health","task_result"].includes(x.type)&&["ok","error"].includes(x.status),
  };
  throw Error("Unexpected "+id);
 };
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require:required,Buffer,Date,process:{env:{}}});
 return exports;
}
const now=Date.parse("2026-11-03T06:00:00.000Z");
const secret="n8n-"+"s".repeat(48);
const env={JARVIS_AGENT_N8N_SECRET:secret};
function signed(source="n8n",offset=0){
 const body=JSON.stringify({version:1,source,messageId:"message-123456",taskId:"task-123456",
  createdAt:new Date(now+offset).toISOString(),type:"health",status:"ok",summary:"worker online"});
 const ts=String(now+offset),sig=createHmac("sha256",secret).update(ts+"."+body).digest("hex");
 return {body,ts,sig};
}
test("accepts authentic event bound to source and timestamp",()=>{
 const a=load(),s=signed();
 assert.equal(a.verifyAgentEnvelope(s.body,s.ts,s.sig,"n8n",now,env).messageId,"message-123456");
 assert.equal(a.verifyAgentEnvelope(s.body,s.ts,s.sig,"windows_agent",now,env),null);
});
test("rejects tampering, missing credentials, expired timestamp and oversized payload",()=>{
 const a=load(),s=signed();
 assert.equal(a.verifyAgentEnvelope(s.body+" ",s.ts,s.sig,"n8n",now,env),null);
 assert.equal(a.verifyAgentEnvelope(s.body,s.ts,s.sig,"n8n",now,{}),null);
 assert.equal(a.verifyAgentEnvelope(s.body,s.ts,s.sig,"n8n",now+600000,env),null);
 assert.equal(a.verifyAgentEnvelope("x".repeat(5000),s.ts,s.sig,"n8n",now,env),null);
});
test("does not autoactivate any remote command",()=>{
 const route=fs.readFileSync("app/api/director/agent-transport/route.ts","utf8");
 assert.ok(route.includes("verifyAgentEnvelope"));
 assert.ok(route.includes("acceptAgentEvent"));
 assert.ok(!route.includes("eval("));
 assert.ok(!route.includes("exec("));
 assert.ok(!route.includes("fetch("));
 const contract=fs.readFileSync("lib/agent-transport-contract.ts","utf8");
 assert.ok(contract.includes("allowRemoteExecution:false"));
});
