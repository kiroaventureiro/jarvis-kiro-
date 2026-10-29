import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("app/api/director/project-status/route.ts", "utf8");
const voice = fs.readFileSync("app/api/voice/route.ts", "utf8");
const memory = JSON.parse(fs.readFileSync("config/operational-memory.json", "utf8"));

test("project status requires authorization and keeps GitHub credential server-side", () => {
  assert.match(route, /await authorized\(\)/);
  assert.match(route, /process\.env\.GITHUB_READ_TOKEN/);
  assert.match(route, /REPO_PATTERN\.test\(repo\)/);
  assert.match(route, /cache: "no-store"/);
  assert.doesNotMatch(route, /Authorization:\s*["']Bearer\s+gh[pousr]_/);
});

test("voice requires authorization and a server-side OpenAI credential", () => {
  assert.match(voice, /await authorized\(\)/);
  assert.match(voice, /process\.env\.OPENAI_API_KEY/);
  assert.match(voice, /lookupJarvisMemory/);
  assert.match(voice, /NÃO recebeu ferramentas externas/);
});

test("curated memory clearly distinguishes provenance from live synchronization", () => {
  assert.ok(memory.records.length >= 3);
  for (const record of memory.records) {
    assert.ok(record.source && record.confidence && record.retrieval_reference);
  }
  assert.match(voice, /não é sincronização ao vivo/i);
});
