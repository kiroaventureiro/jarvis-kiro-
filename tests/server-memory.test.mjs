import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/director/memory-history/route.ts","utf8");
const memory=readFileSync("lib/server-memory.ts","utf8");
const existing=readFileSync("app/api/director/memory/route.ts","utf8");
test("encrypted persistent memory stays opt-in and independent from curated index",()=>{
 assert.match(route,/await authorized\(\)/);
 assert.match(route,/memoryConfigured\(\)/);
 assert.match(route,/export async function DELETE/);
 assert.match(existing,/lookupJarvisMemory/);
 assert.match(memory,/aes-256-gcm/);
 assert.match(memory,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(memory,/JARVIS_MEMORY_ENCRYPTION_KEY/);
 assert.doesNotMatch(route,/ABACUS_API_KEY|askAbacus/);
});
