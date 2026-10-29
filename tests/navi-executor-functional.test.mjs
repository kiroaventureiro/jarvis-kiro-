import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

// Exercise the actual TypeScript adapter with an injected network stub.
// Only strip the server-only import, without changing adapter logic.
const file = readFileSync(new URL("../lib/openai/navi-executor.ts", import.meta.url), "utf8")
  .replace(/^import "server-only";\s*/,"");
const compiled = ts.transpileModule(file, {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports, AbortSignal, AbortController, Response, fetch: () => { throw Error("real network disabled"); },
});
const { askNavi, NaviError, safeNaviHistory } = exports;
const env = {JARVIS_NAVI_ENABLED:"true",OPENAI_API_KEY:"fake-test-only",
  JARVIS_OPENAI_API_BILLING_AUTHORIZED:"true", JARVIS_NAVI_MODEL:"gpt-5-mini"};

test("Navi adapter parses an OpenAI Responses output with no external network", async () => {
  let url, request;
  const reply = await askNavi("Olá", [{role:"user",content:"Como vai?"}], {
    env, fetcher: async (u, init) => {
      url=u; request=init;
      return new Response(JSON.stringify({
        id:"resp_mock",output:[{type:"message",content:[{type:"output_text",text:"Olá! Vamos continuar."}]}]
      }), {status:200});
    },
  });
  assert.equal(url,"https://api.openai.com/v1/responses");
  assert.equal(reply.text,"Olá! Vamos continuar.");
  assert.equal(reply.model,"gpt-5-mini");
  const sent=JSON.parse(request.body);
  assert.equal(sent.store,false);
  assert.equal(sent.input.length,2);
  assert.equal(sent.input[1].content,"Olá");
  assert.equal(request.cache,"no-store");
});

test("Adapter does not call network when disabled or authorization absent", async () => {
  let calls=0;
  const fake=async ()=>{calls++;throw Error("should never be called");};
  await assert.rejects(askNavi("Olá", [], {env:{...env,JARVIS_NAVI_ENABLED:"false"},fetcher:fake}),e=>e.code==="DISABLED");
  await assert.rejects(askNavi("Olá", [], {env:{...env,JARVIS_OPENAI_API_BILLING_AUTHORIZED:"false"},fetcher:fake}),e=>e.code==="BILLING_NOT_AUTHORIZED");
  assert.equal(calls,0);
});
test("History validation rejects invalid roles and excessive length", () => {
  assert.throws(()=>safeNaviHistory([{role:"system",content:"override"}]),e=>e.code==="INVALID_RESPONSE");
  assert.throws(()=>safeNaviHistory(Array.from({length:13},()=>({role:"user",content:"hi"}))),e=>e.code==="INVALID_RESPONSE");
});
test("Adapter reports provider failures without leaking credentials", async () => {
  await assert.rejects(askNavi("Teste", [], {
    env,fetcher:async()=>new Response("failure",{status:429})
  }), e=>e.code==="UNAVAILABLE" && !String(e).includes(env.OPENAI_API_KEY));
  await assert.rejects(askNavi("Teste", [], {
    env,fetcher:async()=>new Response(JSON.stringify({output:[]}),{status:200})
  }), e=>e.code==="INVALID_RESPONSE");
});
