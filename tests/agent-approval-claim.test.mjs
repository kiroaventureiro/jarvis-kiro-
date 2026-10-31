import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../lib/agents/approval-claim-server.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", compiled)(mod, mod.exports, (name) =>
  name === "server-only" ? {} : require(name));
const { claimJarvisApproval } = mod.exports;

const valid = {
  approvalId: "c1323a4e-5b01-4ee4-932a-00a54192a19d",
  ownerId: "owner1",
  action: "publish",
  resource: "kiro-tv",
};
test("rejects mismatched identities, unknown operations, malformed identifiers without network", async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw Error("must not fetch"); };
  try {
    assert.equal(await claimJarvisApproval(valid, "another-owner"), false);
    assert.equal(await claimJarvisApproval({...valid, action: "inspect_status"}, "owner1"), false);
    assert.equal(await claimJarvisApproval({...valid, approvalId: "../invalid"}, "owner1"), false);
    assert.equal(await claimJarvisApproval({...valid, resource: "  "}, "owner1"), false);
    assert.equal(requests, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("uses server-side service key and exact scoped parameters, without leaking key to response", async () => {
  const prior = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  const original = globalThis.fetch;
  try {
    process.env.SUPABASE_URL = "https://jarvis-test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service-key";
    let body;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://jarvis-test.supabase.co/rest/v1/rpc/jarvis_claim_approval");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer mock-service-key");
      body = JSON.parse(options.body);
      return Response.json(true);
    };
    assert.equal(await claimJarvisApproval(valid, "owner1"), true);
    assert.deepEqual(body, {
      p_id: valid.approvalId, p_owner_id: "owner1",
      p_action: "publish", p_resource_id: "kiro-tv",
    });
    globalThis.fetch = async () => Response.json(false);
    assert.equal(await claimJarvisApproval(valid, "owner1"), false);
    globalThis.fetch = async () => Response.json({granted:true});
    await assert.rejects(claimJarvisApproval(valid, "owner1"), /INVALID_APPROVAL_RESPONSE/);
  } finally {
    globalThis.fetch = original;
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
