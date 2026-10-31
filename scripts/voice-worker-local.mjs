#!/usr/bin/env node
/**
 * Jarvis voice worker — local, explicitly invoked job executor.
 * No polling, remote listener, credentials, or public port exposure.
 * Node.js 22+, VoiceStudio already running at 127.0.0.1:3900.
 * Usage: node scripts/voice-worker-local.mjs job.json result.wav
 */
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const PROFILE = "af5bbbba";
const BASE = "http://127.0.0.1:3900";
export function validJob(job, now = Date.now()) {
  return job && typeof job === "object" && !Array.isArray(job)
    && /^[A-Za-z0-9_-]{12,80}$/.test(job.id)
    && job.kind === "synthesize" && job.profileId === PROFILE
    && typeof job.text === "string" && job.text.trim().length > 0
    && job.text.length <= 350 && Number.isSafeInteger(job.expiresAt)
    && job.expiresAt > now && job.expiresAt <= now + 600_000;
}
export async function executeLocalJob(job, output, fetcher = fetch) {
  if (!validJob(job)) throw Error("INVALID_OR_EXPIRED_VOICE_JOB");
  const profiles = await fetcher(BASE + "/profiles", { signal: AbortSignal.timeout(8000), redirect: "error" });
  if (!profiles.ok) throw Error("VOICESTUDIO_UNAVAILABLE");
  const available = await profiles.json();
  if (!Array.isArray(available) || !available.some(p => p?.id === PROFILE))
    throw Error("OFFICIAL_PROFILE_NOT_FOUND");
  const response = await fetcher(BASE + "/v1/audio/speech", {
    method: "POST", redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "audio/wav" },
    body: JSON.stringify({ model: "omnivoice", input: job.text.trim(), voice: PROFILE,
      response_format: "wav", language: "pt", speed: 1 }),
    signal: AbortSignal.timeout(650_000),
  });
  if (!response.ok) throw Error("VOICE_GENERATION_FAILED_" + response.status);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("audio/") && type !== "application/octet-stream")
    throw Error("UNEXPECTED_AUDIO_TYPE");
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length < 44 || data.length > 3_000_000 ||
      Buffer.from(data.subarray(0,4)).toString("ascii") !== "RIFF" ||
      Buffer.from(data.subarray(8,12)).toString("ascii") !== "WAVE")
    throw Error("INVALID_WAV");
  const destination = resolve(output);
  const temporary = destination + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, data, { flag: "wx", mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { jobId: job.id, status: "completed", bytes: data.length, output: destination };
}
if (process.argv[1] && import.meta.url === new URL("file://" + resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    process.stderr.write("Usage: node scripts/voice-worker-local.mjs job.json output.wav\n");
    process.exitCode = 2;
  } else {
    try {
      const job = JSON.parse(await readFile(resolve(input), "utf8"));
      const result = await executeLocalJob(job, output);
      process.stdout.write(JSON.stringify(result) + "\n");
    } catch (error) {
      process.stderr.write(String(error?.message ?? error) + "\n");
      process.exitCode = 1;
    }
  }
}
