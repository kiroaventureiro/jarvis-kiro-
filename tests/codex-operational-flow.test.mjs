import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve, dirname} from "node:path";
import {createRequire} from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const secret = "isolated-test-signing-secret-at-least-32-characters";

// Contract tests use an explicit isolated vault double, never production storage.
function fixture(signingSecret = secret) {
  let state = {version:1, audit:[], plans:[], oauth:{}, connections:{}};
  let authenticated = true;
  const vault = {
    async read() { return structuredClone(state); },
    async update(fn) {
      const pending = structuredClone(state);
      const result = fn(pending);
      state = pending;
      return structuredClone(result);
    },
  };
  const modules = new Map();
  function load(file) {
    const path = resolve(root, file);
    if (modules.has(path)) return modules.get(path);
    const exports = {};
    modules.set(path, exports);
    const source = readFileSync(path, "utf8").replace(/^import "server-only";\s*/, "");
    const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(js, {
      exports, Buffer, Date, Request, Response, URL,
      process:{env:{JARVIS_CODEX_WORKER_SIGNING_SECRET:signingSecret}},
      require(id) {
        if (id === "next/server") return {NextResponse:Response};
        if (id.startsWith("node:")) return require(id);
        const target = resolve(dirname(path), id) + ".ts";
        if (target === resolve(root,"lib/auth.ts")) return {authorized:async()=>authenticated};
        if (target === resolve(root,"lib/connectors/server.ts")) return {connectorStore:vault};
        return load(target);
      },
    });
    return exports;
  }
  return {load, vault, setAuthenticated(value) {authenticated=value;}};
}
const request = (body, origin = "http://localhost") => new Request("http://localhost/api/director/codex", {
  method:"POST", headers:{"Content-Type":"application/json", origin}, body:JSON.stringify(body),
});
const input = {repository:"kiroaventureiro/jarvis-kiro-",branch:"feature/diretor-tecnico-agent",kind:"review",task:"Revisar integração sem publicar nem usar serviços pagos"};

async function draft(f) {
  const response = await f.load("app/api/director/codex/route.ts").POST(request(input));
  assert.equal(response.status,200);
  return (await response.json()).task;
}
async function approve(f, id) {
  return f.load("app/api/director/codex/approve/route.ts").POST(request({taskId:id,approved:true,confirmation:"autorizo esta tarefa"}));
}

test("HTTP contract: draft → explicit approval → signed receipt → blocked dispatch → truthful status/alerts", async () => {
  const f=fixture(), task=await draft(f);
  assert.equal(task.state,"draft");
  const response=await approve(f,task.id), approval=await response.json();
  assert.equal(response.status,200);
  assert.equal(approval.task.state,"approved");
  assert.equal(approval.approvalReceipt,"signed");
  assert.equal(approval.started,false);
  assert.equal(JSON.stringify(approval).includes(secret),false);
  assert.equal("signature" in approval,false);
  assert.equal(await f.load("lib/codex/task-approval.ts").hasValidCodexTaskApproval(task.id),true);
  const dispatch=await f.load("app/api/director/codex/dispatch/route.ts").POST(request({taskId:task.id}));
  assert.equal(dispatch.status,503);
  const dispatchBody=await dispatch.json();
  assert.equal(dispatchBody.started,false);
  assert.equal(dispatchBody.queued,false);
  assert.equal(dispatchBody.approvalVerified,true);
  const saved=await f.load("lib/codex/task-store.ts").getCodexTask(task.id);
  assert.equal(saved.state,"approved");
  const alert=f.load("lib/alerts/contract.ts").codexTaskAlert(saved);
  assert.equal(alert.kind,"approval_required");
  assert.match(alert.speech,/ainda não foi iniciada/);
  const status=await f.load("app/api/director/codex/tasks/[id]/route.ts").GET(
    new Request("http://localhost/api/director/codex/tasks/"+task.id),
    {params:Promise.resolve({id:task.id})});
  assert.equal(status.status,200);
  const body=await status.json();
  assert.equal(body.task.state,"approved");
  assert.equal(body.executorConnected,false);
  assert.equal(body.alert.kind,"approval_required");
});

test("Signed approval rejects altered instructions, task kind, scope, expiry and signature", async () => {
  const f=fixture(), task=await draft(f);
  await approve(f,task.id);
  const verifier=f.load("lib/codex/task-approval.ts").hasValidCodexTaskApproval;
  for (const [field,value] of [["instruction","Publish to production"],["kind","implement"],["branch","main"],["repository","other/repo"]]) {
    await f.vault.update(s=>{s.codexTasks[task.id][field]=value;});
    assert.equal(await verifier(task.id),false);
    await f.vault.update(s=>{s.codexTasks[task.id][field]=task[field];});
  }
  const grant=(await f.vault.read()).codexApprovals[task.id];
  assert.equal(await verifier(task.id,grant.receipt.expiresAt),false);
  await f.vault.update(s=>{s.codexApprovals[task.id].signature="0".repeat(64);});
  assert.equal(await verifier(task.id),false);
});

test("Missing signing key records conversational consent without granting execution authority", async () => {
  const f=fixture(""), task=await draft(f), response=await approve(f,task.id);
  assert.equal((await response.json()).approvalReceipt,"signing_key_missing");
  assert.equal(await f.load("lib/codex/task-approval.ts").hasValidCodexTaskApproval(task.id),false);
  assert.equal((await f.vault.read()).codexTasks[task.id].state,"approved");
  const dispatch=await f.load("app/api/director/codex/dispatch/route.ts").POST(request({taskId:task.id}));
  assert.equal(dispatch.status,503);
  assert.equal((await dispatch.json()).approvalVerified,false);
});

test("Approval revalidates state and scope inside the atomic write and refuses duplicate consent", async () => {
  const f=fixture(), task=await draft(f), service=f.load("lib/codex/task-approval.ts");
  await f.vault.update(s=>{s.codexTasks[task.id].branch="main";});
  await assert.rejects(service.approveCodexTask(task.id),/INVALID_APPROVAL_SCOPE/);
  assert.equal((await f.vault.read()).codexTasks[task.id].state,"draft");
  await f.vault.update(s=>{s.codexTasks[task.id].branch=task.branch;});
  assert.equal((await approve(f,task.id)).status,200);
  assert.equal((await approve(f,task.id)).status,409);
});

test("Scope changed between route read and atomic callback cannot receive approval", async () => {
  const f=fixture(), task=await draft(f), update=f.vault.update;
  f.vault.update=fn=>update(state=>{
    state.codexTasks[task.id].branch="main";
    return fn(state);
  });
  assert.equal((await approve(f,task.id)).status,409);
  const state=await f.vault.read();
  assert.equal(state.codexTasks[task.id].state,"draft");
  assert.equal(state.codexApprovals,undefined);
});

test("Vault write failure cannot produce a successful approval or partial receipt", async () => {
  const f=fixture(), task=await draft(f);
  f.vault.update=async()=>{throw Error("isolated vault outage");};
  const response=await approve(f,task.id);
  assert.equal(response.status,409);
  const state=await f.vault.read();
  assert.equal(state.codexTasks[task.id].state,"draft");
  assert.equal(state.codexApprovals,undefined);
});

test("Routes reject missing session, cross-origin approval and unapproved dispatch", async () => {
  const f=fixture(), task=await draft(f);
  const route=f.load("app/api/director/codex/approve/route.ts");
  const body={taskId:task.id,approved:true,confirmation:"autorizo esta tarefa"};
  assert.equal((await route.POST(request(body,"http://other.example"))).status,403);
  f.setAuthenticated(false);
  assert.equal((await route.POST(request(body))).status,401);
  f.setAuthenticated(true);
  assert.equal((await f.load("app/api/director/codex/dispatch/route.ts").POST(request({taskId:task.id}))).status,409);
});
