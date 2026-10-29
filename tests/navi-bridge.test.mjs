import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const executor = readFileSync(new URL("../lib/openai/navi-executor.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/director/navi/route.ts", import.meta.url), "utf8");
test("Navi is opt-in and separate API billing must be authorized", () => {
  assert.match(executor, /JARVIS_NAVI_ENABLED/);
  assert.match(executor, /JARVIS_OPENAI_API_BILLING_AUTHORIZED/);
  assert.match(executor, /OPENAI_API_KEY/);
  assert.match(executor, /store: false/);
});
test("Server-only OpenAI execution uses bounded history and cancellation", () => {
  assert.match(executor, /import "server-only"/);
  assert.match(executor, /input\.length > 12/);
  assert.match(executor, /message\.length > 3000/);
  assert.match(executor, /AbortSignal\.timeout/);
  assert.match(executor, /cache: "no-store"/);
  assert.doesNotMatch(executor, /console\.log/);
});
test("Navi route requires authentication and same origin", () => {
  assert.match(route, /await authorized\(\)/);
  assert.match(route, /sec-fetch-site/);
  assert.match(route, /origem|Origem/);
  assert.match(route, /safeNaviHistory/);
  assert.match(route, /private, no-store/);
});
