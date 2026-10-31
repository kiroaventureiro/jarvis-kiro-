#!/usr/bin/env node
/**
 * Local test producer for the Jarvis Windows voice inbox.
 * Does not contact cloud services, expose ports or change voice preferences.
 * Usage: node scripts/voice-worker-enqueue.mjs "Jarvis Kiro conectado."
 */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { signVoiceJob } from "./voice-job-auth.mjs";

export async function enqueueLocalVoice(text, {
  secret = process.env.JARVIS_VOICE_WORKER_SECRET,
  root = process.env.JARVIS_VOICE_INBOX || join(homedir(), ".jarvis-kiro", "voice-inbox"),
  now = Date.now(),
} = {}) {
  if (typeof text !== "string" || !text.trim() || text.length > 350)
    throw Error("INVALID_VOICE_TEXT");
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw Error("JARVIS_VOICE_WORKER_SECRET_REQUIRED");
  const job = {
    id: "voice_" + randomBytes(16).toString("hex"),
    kind: "synthesize",
    profileId: "af5bbbba",
    text: text.trim(),
    expiresAt: now + 600_000,
  };
  const signature = signVoiceJob(job, secret);
  const incoming = join(resolve(root), "incoming");
  await mkdir(incoming, { recursive: true, mode: 0o700 });
  const finalName = join(incoming, job.id + ".json");
  const temporary = join(incoming, "." + randomUUID() + ".tmp");
  try {
    await writeFile(temporary, JSON.stringify({ job, signature }), { flag: "wx", mode: 0o600 });
    await rename(temporary, finalName);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { id: job.id, queuedAt: now, path: finalName };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const text = process.argv.slice(2).join(" ");
    const result = await enqueueLocalVoice(text);
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) {
    process.stderr.write(String(error?.message || error) + "\n");
    process.exitCode = 1;
  }
}
