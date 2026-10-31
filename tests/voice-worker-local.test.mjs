import test from "node:test";
import assert from "node:assert/strict";
import { validJob, executeLocalJob } from "../scripts/voice-worker-local.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

test("writes valid generated WAV and preserves voice id", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-voice-test-"));
  const wav = Buffer.alloc(64);
  wav.write("RIFF", 0, "ascii");
  wav.write("WAVE", 8, "ascii");
  const urls = [];
  const fetcher = async (url, options) => {
    urls.push({ url, options });
    if (url.endsWith("/profiles"))
      return { ok: true, json: async () => [{ id: "af5bbbba" }] };
    return { ok: true, headers: new Headers({ "content-type": "audio/wav" }),
      arrayBuffer: async () => Uint8Array.from(wav).buffer };
  };
  try {
    const result = await executeLocalJob(job, join(dir, "voice.wav"), fetcher);
    assert.equal(result.status, "completed");
    assert.deepEqual(await readFile(join(dir, "voice.wav")), wav);
    assert.equal(urls.length, 2);
    assert.equal(JSON.parse(urls[1].options.body).voice, "af5bbbba");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("rejects malformed audio without creating an output file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-voice-test-"));
  const output = join(dir, "voice.wav");
  const fetcher = async (url) => url.endsWith("/profiles")
    ? { ok: true, json: async () => [{ id: "af5bbbba" }] }
    : { ok: true, headers: new Headers({ "content-type": "audio/wav" }),
        arrayBuffer: async () => new Uint8Array(64).buffer };
  try {
    await assert.rejects(executeLocalJob(job, output, fetcher), /INVALID_WAV/);
    await assert.rejects(readFile(output), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
