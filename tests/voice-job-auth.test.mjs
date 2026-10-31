import assert from "node:assert/strict";
import test from "node:test";
import { signVoiceJob, verifyVoiceJob } from "../scripts/voice-job-auth.mjs";

const secret = "local-test-secret-with-at-least-32-characters";
const now = 1793478000000;
const job = {
  id: "signed_voice_request_1234",
  kind: "synthesize",
  profileId: "af5bbbba",
  text: "Jarvis pronto.",
  expiresAt: now + 60_000,
};
test("valid signed voice jobs are accepted", () => {
  const signature = signVoiceJob(job, secret);
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(verifyVoiceJob(job, signature, secret, now), true);
});
test("tampering with text, profile or expiry invalidates signed jobs", () => {
  const signature = signVoiceJob(job, secret);
  for (const forged of [
    {...job, text: "Outra fala"},
    {...job, profileId: "334728d0"},
    {...job, expiresAt: now + 120_000},
  ]) assert.equal(verifyVoiceJob(forged, signature, secret, now), false);
});
test("expired, malformed and unsigned requests fail closed", () => {
  const signature = signVoiceJob(job, secret);
  assert.equal(verifyVoiceJob(job, signature, secret, now + 120_000), false);
  assert.equal(verifyVoiceJob(job, "not-a-signature", secret, now), false);
  assert.equal(verifyVoiceJob(job, signature, "short", now), false);
  assert.equal(verifyVoiceJob(null, signature, secret, now), false);
  assert.throws(() => signVoiceJob(job, "short"), /CONFIGURATION_INVALID/);
});
