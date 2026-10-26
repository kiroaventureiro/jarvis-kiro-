import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync("app/api/voice/route.ts", "utf8");
test("voice session receives a small documented memory snapshot", () => {
  assert.match(
    source,
    /lookupJarvisMemory\(\s*"Jarvis Kiro Sistema Origem Supabase arquitetura",\s*3,?\s*\)/,
  );
  assert.match(source, /memoryContext/);
  assert.match(source, /Origem:/);
  assert.match(source, /Confiança:/);
  assert.match(source, /não é sincronização ao vivo/);
});
test("memory enrichment does not change owner authentication", () => {
  assert.match(source, /await authorized\(\)/);
});
