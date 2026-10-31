import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enqueueLocalVoice } from "../scripts/voice-worker-enqueue.mjs";
import { verifyVoiceJob } from "../scripts/voice-job-auth.mjs";

test("local producer writes a correctly signed official voice request", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-voice-queue-"));
  const secret = "example-test-secret-longer-than-thirty-two-bytes";
  try {
    const enqueued = await enqueueLocalVoice("Jarvis Kiro pronto.", { root, secret });
    const envelope = JSON.parse(await readFile(enqueued.path, "utf8"));
    assert.equal(envelope.job.profileId, "af5bbbba");
    assert.equal(envelope.job.text, "Jarvis Kiro pronto.");
    assert.equal(verifyVoiceJob(envelope.job, envelope.signature, secret), true);
    assert.equal(verifyVoiceJob(envelope.job, envelope.signature, secret + "-different"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("producer rejects missing credentials and invalid text", async () => {
  await assert.rejects(enqueueLocalVoice("fala", {secret:"short"}), /SECRET_REQUIRED/);
  await assert.rejects(enqueueLocalVoice("", {secret:"x".repeat(32)}), /INVALID_VOICE_TEXT/);
});
