import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const client = fs.readFileSync("lib/abacus-routellm.ts", "utf8"),
  api = fs.readFileSync("app/api/director/abacus/route.ts", "utf8"),
  gateway = fs.readFileSync("lib/voice/abacus-gateway.ts", "utf8");
test("Abacus key remains server-only and requests are capped", () => {
  assert.match(client, /process\.env\.ABACUS_API_KEY/);
  const transport = fs.readFileSync("lib/abacus/transport.ts", "utf8"),
    protocol = fs.readFileSync("lib/abacus/protocol.ts", "utf8");
  assert.match(transport, /routellm\.abacus\.ai\/v1\/chat\/completions/);
  assert.match(protocol, /max_tokens:\s*350/);
  assert.match(transport, /AbortController/);
  assert.doesNotMatch(client, /NEXT_PUBLIC_ABACUS/);
});
test("Abacus endpoint retains authentication and gateway rejects missing keys and oversized text", () => {
  assert.match(api, /await authorized\(\)/);
  assert.match(api, /status:\s*401/);
  assert.match(gateway, /503/);
  assert.match(gateway, /message\.length\s*>\s*1500/);
  assert.match(api, /costPermission/);
});
