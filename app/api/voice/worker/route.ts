import { createHash, randomBytes, randomUUID } from "node:crypto";
import { authorized } from "../../../../lib/auth";
import { sameOrigin } from "../../../../lib/abacus/http";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
    throw new Error("VOICE_WORKER_STORE_NOT_CONFIGURED");
  return { url, key };
}
async function db(path: string, method = "GET", body?: unknown) {
  const c = config();
  const response = await fetch(c.url + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: c.key,
      Authorization: "Bearer " + c.key,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("VOICE_WORKER_STORE_UNAVAILABLE");
  return response.status === 204 ? [] : response.json();
}
async function readBody(request: Request, max = 4096) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new Error("INVALID_CONTENT_TYPE");
  const raw = await request.text();
  if (raw.length > max) throw new Error("BODY_TOO_LARGE");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_BODY");
  return value as Record<string, unknown>;
}
async function device(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const rows = await db("jarvis_voice_worker_devices?token_hash=eq." + digest(token) +
    "&revoked_at=is.null&select=id&limit=1");
  return Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : null;
}

export async function POST(request: Request) {
  try {
    const body = await readBody(request, 4100000);
    const action = body.action;
    if (action === "create_pairing") {
      if (!(await authorized())) return json({ error: "Não autorizado" }, 401);
      if (!sameOrigin(request)) return json({ error: "Origem inválida" }, 403);
      const code = randomBytes(4).toString("hex").toUpperCase();
      await db("jarvis_voice_worker_pairings", "POST", {
        code_hash: digest(code), expires_at: new Date(Date.now() + 300000).toISOString(),
      });
      return json({ code, expiresInSeconds: 300 });
    }
    if (action === "pair") {
      const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
      if (!/^[A-F0-9]{8}$/.test(code)) return json({ error: "Código inválido" }, 400);
      const pairs = await db("jarvis_voice_worker_pairings?code_hash=eq." + digest(code) +
        "&consumed_at=is.null&expires_at=gt." + encodeURIComponent(new Date().toISOString()) +
        "&select=code_hash&limit=1");
      if (!Array.isArray(pairs) || !pairs.length) return json({ error: "Código expirado ou já utilizado" }, 410);
      const consumed = await db("jarvis_voice_worker_pairings?code_hash=eq." + digest(code) +
        "&consumed_at=is.null", "PATCH", { consumed_at: new Date().toISOString() });
      if (!Array.isArray(consumed) || !consumed.length) return json({ error: "Código já utilizado" }, 409);
      const token = randomBytes(32).toString("hex");
      const id = randomUUID();
      await db("jarvis_voice_worker_devices", "POST", { id, token_hash: digest(token) });
      return json({ deviceId: id, token });
    }
    const deviceId = await device(request);
    if (!deviceId) return json({ error: "Dispositivo não autorizado" }, 401);
    if (action === "heartbeat") {
      // Idle workers must report presence too; a claim is not a heartbeat.
      await db("jarvis_voice_worker_devices?id=eq." + encodeURIComponent(deviceId),
        "PATCH", { last_seen_at: new Date().toISOString() });
      return json({ ok: true });
    }
    if (action === "claim") {
      // Every successful poll is proof the local worker is alive, even if idle.
      // Compatible with already-running older worker scripts.
      await db("jarvis_voice_worker_devices?id=eq." + encodeURIComponent(deviceId),
        "PATCH", { last_seen_at: new Date().toISOString() });
      // A stopped worker must not cause expired requests to block new speech.
      // Older jobs are marked failed and are never sent for synthesis.
      // Also retire abandoned processing jobs after the local synthesis
      // deadline plus a recovery margin, without retrying an unsafe job.
      const abandoned = new Date(Date.now() - 1200000).toISOString();
      await db("jarvis_voice_jobs?status=eq.processing&claimed_at=lt." +
        encodeURIComponent(abandoned), "PATCH", {
          status: "failed", error_code: "VOICE_WORKER_TIMED_OUT",
          completed_at: new Date().toISOString(),
        });
      const cutoff = new Date(Date.now() - 600000).toISOString();
      await db("jarvis_voice_jobs?status=eq.queued&created_at=lt." +
        encodeURIComponent(cutoff), "PATCH", {
          status: "failed", error_code: "VOICE_JOB_EXPIRED",
          completed_at: new Date().toISOString(),
        });
      const jobs = await db("jarvis_voice_jobs?status=eq.queued&created_at=gte." +
        encodeURIComponent(cutoff) +
        "&select=id,payload,created_at&order=created_at.desc&limit=1");
      if (!Array.isArray(jobs) || !jobs.length) return json({ job: null });
      const job = jobs[0];
      if (Number(job.payload?.expiresAt) <= Date.now()) {
        await db("jarvis_voice_jobs?id=eq." + encodeURIComponent(job.id) +
          "&status=eq.queued", "PATCH", {
            status: "failed", error_code: "VOICE_JOB_EXPIRED",
            completed_at: new Date().toISOString(),
          });
        return json({ job: null });
      }
      const claimed = await db("jarvis_voice_jobs?id=eq." + encodeURIComponent(job.id) +
        "&status=eq.queued", "PATCH", {
          status: "processing", device_id: deviceId, claimed_at: new Date().toISOString(),
        });
      if (!Array.isArray(claimed) || !claimed.length) return json({ job: null });
      await db("jarvis_voice_worker_devices?id=eq." + encodeURIComponent(deviceId),
        "PATCH", { last_seen_at: new Date().toISOString() });
      return json({ job: { id: job.id, ...job.payload } });
    }
    if (action === "complete") {
      const id = typeof body.id === "string" ? body.id : "";
      const status = body.status;
      if (!/^voice_[A-Za-z0-9_-]{12,80}$/.test(id) ||
          (status !== "completed" && status !== "failed"))
        return json({ error: "Resultado inválido" }, 400);
      // Verify ownership before storing any audio: an expired, reclaimed, or
      // foreign job must not create orphaned WAV data.
      const owned = await db("jarvis_voice_jobs?id=eq." + encodeURIComponent(id) +
        "&device_id=eq." + encodeURIComponent(deviceId) +
        "&status=eq.processing&select=id&limit=1");
      if (!Array.isArray(owned) || !owned.length)
        return json({ error: "Tarefa não encontrada" }, 404);
      if (status === "completed") {
        const audio = typeof body.audioBase64 === "string" ? body.audioBase64 : "";
        if (!audio || audio.length > 4000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio))
          return json({ error: "Áudio inválido" }, 400);
        const bytes = Buffer.from(audio, "base64");
        if (bytes.length < 44 || bytes.length > 3000000 ||
            bytes.toString("ascii", 0, 4) !== "RIFF" ||
            bytes.toString("ascii", 8, 12) !== "WAVE")
          return json({ error: "WAV inválido" }, 400);
        await db("jarvis_voice_worker_audio", "POST", { job_id: id, audio_base64: audio });
      }
      const result = await db("jarvis_voice_jobs?id=eq." + encodeURIComponent(id) +
        "&device_id=eq." + encodeURIComponent(deviceId) + "&status=eq.processing",
        "PATCH", {
          status, completed_at: new Date().toISOString(),
          error_code: status === "failed" && typeof body.errorCode === "string" &&
            /^[A-Z0-9_]{1,80}$/.test(body.errorCode) ? body.errorCode : null,
        });
      if (!Array.isArray(result) || !result.length) return json({ error: "Tarefa não encontrada" }, 404);
      return json({ ok: true });
    }
    return json({ error: "Ação desconhecida" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "BODY_TOO_LARGE" ? 413 :
      message === "INVALID_CONTENT_TYPE" || message === "INVALID_BODY" ? 400 : 503;
    return json({ error: status === 503 ? "Serviço de voz indisponível" : "Requisição inválida" }, status);
  }
}

export async function GET(request: Request) {
  if (!(await authorized())) return json({ error: "Não autorizado" }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^voice_[A-Za-z0-9_-]{12,80}$/.test(id))
    return json({ error: "Identificador inválido" }, 400);
  try {
    const jobs = await db("jarvis_voice_jobs?id=eq." + encodeURIComponent(id) +
      "&select=id,status,error_code&limit=1");
    if (!Array.isArray(jobs) || !jobs.length) return json({ error: "Tarefa não encontrada" }, 404);
    const job = jobs[0];
    if (job.status === "failed") return json({ status: "failed", errorCode: job.error_code });
    if (job.status !== "completed") return json({ status: job.status });
    const files = await db("jarvis_voice_worker_audio?job_id=eq." +
      encodeURIComponent(id) + "&select=audio_base64&limit=1");
    if (!Array.isArray(files) || !files.length) return json({ status: "processing" });
    const bytes = Buffer.from(String(files[0].audio_base64), "base64");
    return new Response(new Uint8Array(bytes), {
      status: 200, headers: { ...headers, "Content-Type": "audio/wav",
        "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return json({ error: "Não foi possível consultar a tarefa" }, 503);
  }
}

export async function PUT(request: Request) {
  if (!(await authorized())) return json({ error: "Não autorizado" }, 401);
  if (!sameOrigin(request)) return json({ error: "Origem inválida" }, 403);
  try {
    const body = await readBody(request);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 350) return json({ error: "Texto inválido" }, 400);
    const id = "voice_" + randomUUID().replace(/-/g, "");
    await db("jarvis_voice_jobs", "POST", {
      id, payload: { kind: "synthesize", profileId: "af5bbbba", text,
        expiresAt: Date.now() + 600000 },
    });
    return json({ id, status: "queued" }, 202);
  } catch {
    return json({ error: "Não foi possível enfileirar a fala" }, 503);
  }
}
