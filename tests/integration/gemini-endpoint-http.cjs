// Run after `npm run build`. Real Next HTTP handlers, generated LOCAL session,
// invalid cost gates/empty key/store: never Google, never production credentials.
const { spawn } = require("node:child_process");
const { randomBytes, createHmac } = require("node:crypto");
const assert = require("node:assert/strict");
const { setTimeout: sleep } = require("node:timers/promises");
(async () => {
  const cases = [
    { name: "unauthenticated", expected: [401, "AUTH_REQUIRED"] },
    { name: "disabled", auth: true, expected: [403, "LIVE_DISABLED"] },
    { name: "missing-key", auth: true, env: { JARVIS_GEMINI_LIVE_ENABLED: "true" }, expected: [503, "KEY_MISSING"] },
    { name: "unapproved-cost", auth: true, env: { JARVIS_GEMINI_LIVE_ENABLED: "true", GEMINI_API_KEY: "local-dummy" }, expected: [403, "COST_NOT_APPROVED"] },
    { name: "invalid-budget", auth: true, env: { JARVIS_GEMINI_LIVE_ENABLED: "true", GEMINI_API_KEY: "local-dummy", JARVIS_GEMINI_LIVE_PAID_ALLOWED: "true" }, expected: [503, "SESSION_BUDGET_INVALID"] },
    { name: "no-persistent-limit", auth: true, env: { JARVIS_GEMINI_LIVE_ENABLED: "true", GEMINI_API_KEY: "local-dummy", JARVIS_GEMINI_LIVE_PAID_ALLOWED: "true", JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR: "1" }, expected: [503, "PERSISTENT_LIMIT_UNAVAILABLE"] },
    { name: "production-refused", auth: true, env: { VERCEL_ENV: "production" }, expected: [403, "PRODUCTION_BLOCKED"] },
  ];
  let index = 0;
  for (const entry of cases) {
    const secret = randomBytes(32).toString("hex"), port = 3290 + index++;
    const origin = `http://localhost:${port}`, expiry = String(Date.now() + 60000);
    const cookie = `jarvis_session=${expiry}.${createHmac("sha256", secret).update(expiry).digest("hex")}`;
    const env = { ...process.env, VERCEL_ENV: "preview", JARVIS_SESSION_SECRET: secret,
      GEMINI_API_KEY: "", JARVIS_GEMINI_LIVE_ENABLED: "false", JARVIS_GEMINI_LIVE_PAID_ALLOWED: "false", JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR: "0",
      JARVIS_CONNECTOR_STORE_URL: "", JARVIS_CONNECTOR_STORE_KEY: "", JARVIS_CONNECTOR_ENCRYPTION_KEY: "", ...entry.env };
    const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"], { env, stdio: "ignore" });
    try {
      let ready = false;
      for (let i = 0; i < 80; i++) {
        try { await fetch(origin); ready = true; break; } catch { await sleep(100); }
      }
      assert.ok(ready, "Next server readiness");
      for (const method of ["GET", "POST"]) {
        const response = await fetch(`${origin}/api/voice/gemini-token`, { method, headers: { Origin: origin, ...(entry.auth ? { Cookie: cookie } : {}), "Content-Type": "application/json" }, ...(method === "POST" ? { body: "{}" } : {}) });
        const body = await response.json();
        assert.deepEqual([response.status, body.code], entry.expected, `${entry.name} ${method}`);
        assert.ok(!JSON.stringify(body).includes(secret)); assert.equal(body.token, undefined);
        console.log(`${entry.name} ${method}: HTTP ${response.status} ${body.code}`);
      }
      const cross = await fetch(`${origin}/api/voice/gemini-token`, { method: "POST", headers: { Origin: "https://attacker.example", Cookie: cookie, "Content-Type": "application/json" }, body: "{}" });
      assert.equal(cross.status, 403); assert.equal((await cross.json()).code, "ORIGIN_DENIED");
    } finally {
      child.kill("SIGTERM"); await new Promise(resolve => child.once("exit", resolve));
    }
  }
  console.log("HTTP endpoint checks passed; no Google request or paid session.");
})().catch(error => { console.error(error); process.exitCode = 1; });
