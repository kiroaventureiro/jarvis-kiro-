import test from "node:test";
import assert from "node:assert/strict";
import { validJob, executeLocalJob } from "../scripts/voice-worker-local.mjs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

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
    return new Response(Uint8Array.from(wav), { headers: { "content-type": "audio/wav" } });
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
    : new Response(new Uint8Array(64), { headers: { "content-type": "audio/wav" } });
  try {
    await assert.rejects(executeLocalJob(job, output, fetcher), /INVALID_WAV/);
    await assert.rejects(readFile(output), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("does not overwrite an existing WAV", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-voice-test-"));
  const output = join(dir, "voice.wav");
  const existing = Buffer.from("EXISTING AUDIO");
  const generated = Buffer.alloc(64);
  generated.write("RIFF", 0, "ascii");
  generated.write("WAVE", 8, "ascii");
  const fetcher = async (url) => url.endsWith("/profiles")
    ? { ok: true, json: async () => [{ id: "af5bbbba" }] }
    : new Response(generated, { headers: { "content-type": "audio/wav" } });
  try {
    await writeFile(output, existing);
    await assert.rejects(executeLocalJob(job, output, fetcher), { code: "EEXIST" });
    assert.deepEqual(await readFile(output), existing);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Windows worker CLI refuses unsigned jobs before any local request", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-voice-auth-"));
  const input = join(dir, "job.json");
  const output = join(dir, "result.wav");
  try {
    await writeFile(input, JSON.stringify(job));
    const result = spawnSync(process.execPath, [resolve("scripts/voice-worker-local.mjs"), input, output], {
      encoding: "utf8",
      env: { ...process.env, JARVIS_VOICE_WORKER_SECRET: "" },
      timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VOICE_JOB_AUTHENTICATION_REQUIRED/);
    await assert.rejects(readFile(output), { code: "ENOENT" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
