import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../lib/memory/topic-storage.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", js)(module, module.exports, (name) =>
  name === "server-only" ? {} : require(name));
const { writeMemoryTopic, readMemoryTopics, deleteMemoryTopic } = module.exports;
const previous = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  secret: process.env.JARVIS_MEMORY_ENCRYPTION_KEY,
};
const originalFetch = globalThis.fetch;
const rows = new Map();
const calls = [];
test.before(() => {
  process.env.SUPABASE_URL = "https://memory-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-key";
  process.env.JARVIS_MEMORY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  globalThis.fetch = async (url, options) => {
    const u = new URL(url);
    calls.push({ method: options.method, url: u.toString() });
    const owner = u.searchParams.get("owner_id")?.slice(3);
    const id = u.searchParams.get("topic_id")?.slice(3);
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      rows.set(body.owner_id + ":" + body.topic_id, body.encrypted_payload);
      return new Response(null, { status: 204 });
    }
    if (options.method === "DELETE") {
      rows.delete(owner + ":" + id);
      return new Response(null, { status: 204 });
    }
    const found = [...rows.entries()].filter(([k]) => k.startsWith(owner + ":"))
      .map(([k, encrypted_payload]) => ({ topic_id: k.split(":")[1], encrypted_payload }));
    return Response.json(found);
  };
});
test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries({
    SUPABASE_URL: previous.url,
    SUPABASE_SERVICE_ROLE_KEY: previous.key,
    JARVIS_MEMORY_ENCRYPTION_KEY: previous.secret,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test("encrypted topic round trip and deletion; no plaintext in request", async () => {
  await writeMemoryTopic("owner1", { id: "tv", title: "TV", summary: "Informacao pessoal" });
  const stored = rows.get("owner1:tv");
  assert.ok(stored);
  assert.ok(!stored.includes("Informacao pessoal"));
  assert.deepEqual((await readMemoryTopics("owner1")).map((x) => x.summary), ["Informacao pessoal"]);
  assert.deepEqual(await readMemoryTopics("owner2"), []);
  await deleteMemoryTopic("owner1", "tv");
  assert.deepEqual(await readMemoryTopics("owner1"), []);
});
test("rejects invalid topic data before storage", async () => {
  const before = calls.length;
  await assert.rejects(writeMemoryTopic("owner1", { id: "bad", title: "Bad", summary: "x", tags: [123] }), /INVALID_TOPIC_INPUT/);
  await assert.rejects(writeMemoryTopic("owner1", { id: "bad", title: "Bad", summary: null }), /INVALID_TOPIC_INPUT/);
  assert.equal(calls.length, before);
});
