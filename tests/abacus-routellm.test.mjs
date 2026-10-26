import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const client=fs.readFileSync("lib/abacus-routellm.ts","utf8");
const api=fs.readFileSync("app/api/director/abacus/route.ts","utf8");
test("Abacus key remains server-only and requests are capped",()=>{
 assert.ok(client.includes("process.env.ABACUS_API_KEY"));
 assert.ok(client.includes("routellm.abacus.ai/v1/chat/completions"));
 assert.ok(client.includes('max_tokens:350'));
 assert.ok(client.includes("AbortController"));
 assert.ok(!client.includes("NEXT_PUBLIC_ABACUS"));
});
test("Abacus endpoint requires auth and missing keys fail closed",()=>{
 assert.ok(api.includes("await authorized()"));
 assert.ok(api.includes("status:401"));
 assert.ok(api.includes("status:503"));
 assert.ok(api.includes("message.length>1500"));
});
