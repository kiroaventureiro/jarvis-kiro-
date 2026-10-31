import { createHmac, timingSafeEqual } from "node:crypto";

const ID = /^[A-Za-z0-9_-]{12,80}$/;
const PROFILE = "af5bbbba";

/**
 * HMAC integrity for future authenticated voice delivery.
 * This is NOT a transport, pairing protocol or replay database.
 * Secret must come from a separately authenticated device pairing flow.
 */
function payload(job) {
  if (!job || typeof job !== "object" || Array.isArray(job) ||
      !ID.test(job.id) || job.kind !== "synthesize" ||
      job.profileId !== PROFILE || typeof job.text !== "string" ||
      job.text.trim().length < 1 || job.text.length > 350 ||
      !Number.isSafeInteger(job.expiresAt)) return null;
  return JSON.stringify([job.id, job.kind, job.profileId, job.text, job.expiresAt]);
}
function signature(data, secret) {
  return createHmac("sha256", secret).update("jarvis-voice-job-v1\n").update(data).digest();
}
export function signVoiceJob(job, secret) {
  const data = payload(job);
  if (!data || typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32)
    throw Error("VOICE_JOB_SIGNING_CONFIGURATION_INVALID");
  return signature(data, secret).toString("hex");
}
export function verifyVoiceJob(job, suppliedSignature, secret, now = Date.now()) {
  const data = payload(job);
  if (!data || typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32 ||
      typeof suppliedSignature !== "string" || !/^[a-f0-9]{64}$/i.test(suppliedSignature) ||
      job.expiresAt <= now || job.expiresAt > now + 600_000) return false;
  const expected = signature(data, secret);
  const actual = Buffer.from(suppliedSignature, "hex");
  return timingSafeEqual(actual, expected);
}
