#!/usr/bin/env node
/**
 * Jarvis cloud-to-Windows VoiceStudio bridge.
 * Pair once with a short-lived code from the authenticated Jarvis UI, then
 * poll the private HTTPS API and synthesize only validated VoiceStudio jobs.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { executeLocalJob, reserveVoiceJobId, validJob } from "./voice-worker-local.mjs";

const root = resolve(process.env.JARVIS_VOICE_WORKER_HOME || join(homedir(), ".jarvis-kiro"));
const credentialFile = join(root, "worker-device.json");
const api = (process.env.JARVIS_VOICE_WORKER_URL || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(api)) throw Error("JARVIS_VOICE_WORKER_URL_HTTPS_REQUIRED");

async function call(action, body = {}, token) {
  const response = await fetch(api + "/api/voice/worker", {
    method: "POST", redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify({ action, ...body }), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || "VOICE_WORKER_API_" + response.status);
  return data;
}
async function pair(code) {
  const result = await call("pair", { code });
  await mkdir(root, { recursive: true, mode: 0o700 });
  await writeFile(credentialFile, JSON.stringify(result), { flag: "wx", mode: 0o600 });
  process.stdout.write("Dispositivo Jarvis pareado com sucesso. Credencial salva localmente.\n");
}
async function run() {
  const credentials = JSON.parse(await readFile(credentialFile, "utf8"));
  if (typeof credentials.token !== "string" || typeof credentials.deviceId !== "string")
    throw Error("WORKER_CREDENTIAL_INVALID");
  process.stdout.write("Jarvis Voice Worker conectado. Aguardando tarefas...\n");
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  while (!stopping) {
    try {
      const result = await call("claim", {}, credentials.token);
      if (!result.job) { await delay(1800); continue; }
      const job = result.job;
      try {
        if (!validJob(job)) throw Error("INVALID_OR_EXPIRED_VOICE_JOB");
        await reserveVoiceJobId(job.id);
        const output = join(root, "voice-inbox", "audio", job.id + ".wav");
        const { mkdir: makeDir } = await import("node:fs/promises");
        await makeDir(join(root, "voice-inbox", "audio"), { recursive: true, mode: 0o700 });
        const audio = await executeLocalJob(job, output);
        const audioBase64 = (await readFile(output)).toString("base64");
        await call("complete", { id: job.id, status: "completed", audioBase64 }, credentials.token);
        process.stdout.write("Áudio gerado e entregue ao Jarvis: " + audio.output + "\\n");
      } catch (error) {
        const code = String(error?.message || "VOICE_JOB_FAILED").replace(/[^A-Z0-9_]/g, "_").toUpperCase().slice(0,80);
        await call("complete", { id: job.id, status: "failed", errorCode: code }, credentials.token).catch(() => {});
        process.stderr.write("Falha na tarefa " + job.id + ": " + code + "\n");
      }
    } catch (error) {
      process.stderr.write("Worker: " + String(error?.message || error) + "\n");
      await delay(4000);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, code] = process.argv.slice(2);
  try {
    if (command === "pair" && code) await pair(code);
    else if (command === "run") await run();
    else throw Error("Uso: node scripts/voice-worker-cloud.mjs pair CODIGO | run");
  } catch (error) {
    process.stderr.write(String(error?.message || error) + "\n");
    process.exitCode = 1;
  }
}
