#!/usr/bin/env node
/**
 * Jarvis VoiceStudio local inbox worker (Windows / Node 22+).
 * Reads ONLY locally delivered signed jobs. Does not open a port or poll the
 * public internet. The cloud-to-inbox transport is intentionally NOT included.
 */
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { verifyVoiceJob } from "./voice-job-auth.mjs";
import { executeLocalJob, reserveVoiceJobId } from "./voice-worker-local.mjs";

const root = resolve(process.env.JARVIS_VOICE_INBOX || join(homedir(), ".jarvis-kiro", "voice-inbox"));
const dirs = { incoming: join(root, "incoming"), processing: join(root, "processing"),
  completed: join(root, "completed"), failed: join(root, "failed"),
  audio: join(root, "audio") };
const secret = process.env.JARVIS_VOICE_WORKER_SECRET;
if (!secret || Buffer.byteLength(secret, "utf8") < 32)
  throw Error("JARVIS_VOICE_WORKER_SECRET_REQUIRED");

for (const folder of Object.values(dirs)) await mkdir(folder, { recursive: true, mode: 0o700 });

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function handle(name) {
  if (!/^[a-zA-Z0-9_-]{12,80}\.json$/.test(name)) return;
  const src = join(dirs.incoming, name);
  const inProcess = join(dirs.processing, name);
  try {
    await rename(src, inProcess);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  let id = name.slice(0,-5);
  try {
    const file = await readFile(inProcess);
    if (file.length > 4096) throw Error("VOICE_JOB_TOO_LARGE");
    const envelope = JSON.parse(file.toString("utf8"));
    const job = envelope?.job;
    if (!job || job.id !== id || !verifyVoiceJob(job, envelope.signature, secret))
      throw Error("VOICE_JOB_AUTHENTICATION_REQUIRED");
    await reserveVoiceJobId(id);
    const result = await executeLocalJob(job, join(dirs.audio, id + ".wav"));
    await writeFile(join(dirs.completed, id + ".json"),
      JSON.stringify({ jobId: id, status: "completed", bytes: result.bytes }),
      { flag: "wx", mode: 0o600 });
    await rename(inProcess, join(dirs.completed, name));
    process.stdout.write("Completed " + id + "\n");
  } catch (error) {
    await writeFile(join(dirs.failed, id + ".error.txt"),
      String(error?.message || "VOICE_JOB_FAILED").slice(0,200),
      { flag: "wx", mode: 0o600 }).catch(() => {});
    await rename(inProcess, join(dirs.failed, name)).catch(() => {});
    process.stderr.write("Failed " + id + ": " + String(error?.message) + "\n");
  }
}

process.stdout.write("Jarvis local inbox ready (no public listener). Folder: " + dirs.incoming + "\n");
while (!stopping) {
  const files = (await readdir(dirs.incoming)).filter(name => /^[a-zA-Z0-9_-]{12,80}\.json$/.test(name));
  for (const name of files) {
    if (stopping) break;
    await handle(name);
  }
  if (!stopping) await delay(1200);
}
