import test from "node:test";
import assert from "node:assert/strict";
import { validJob, executeLocalJob } from "../scripts/voice-worker-local.mjs";

const now = Date.now();
const job = { id: "voice_test_123456", kind: "synthesize", profileId: "af5bbbba", text: "Olá, Jarvis.", expiresAt: now + 60_000 };
test("accepts official local job", () => assert.equal(validJob(job, now), true));
test("rejects other profiles, expired jobs and long text", () => {
  for (const candidate of [
    { ...job, profileId: "334728d0" },
    { ...job, expiresAt: now - 1 },
    { ...job, text: "A".repeat(351) },
    { ...job, id: "../escape" },
  ]) assert.equal(validJob(candidate, now), false);
});
test("does not synthesize when official profile is absent", async () => {
  let calls = 0;
  await assert.rejects(
    executeLocalJob(job, "unused.wav", async () => {
      calls++;
      return { ok: true, json: async () => [{ id: "334728d0" }] };
    }),
    /OFFICIAL_PROFILE_NOT_FOUND/
  );
  assert.equal(calls, 1);
});
