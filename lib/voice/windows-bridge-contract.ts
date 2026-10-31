/** Untrusted relay messages for the future Windows voice worker.
 * Transport is deliberately absent: never expose VoiceStudio localhost to the internet.
 */
export const OFFICIAL_PROFILE_ID = "af5bbbba";
export type VoiceJob = {
  id: string;
  kind: "synthesize";
  profileId: typeof OFFICIAL_PROFILE_ID;
  text: string;
  expiresAt: number;
};
const idPattern = /^[a-zA-Z0-9_-]{12,80}$/;
export function parseVoiceJob(value: unknown, now: number = Date.now()): VoiceJob | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const job = value as Record<string, unknown>;
  if (
    typeof job.id !== "string" || !idPattern.test(job.id) ||
    job.kind !== "synthesize" ||
    job.profileId !== OFFICIAL_PROFILE_ID ||
    typeof job.text !== "string" ||
    job.text.trim().length === 0 || job.text.length > 350 ||
    typeof job.expiresAt !== "number" || !Number.isSafeInteger(job.expiresAt) ||
    job.expiresAt <= now || job.expiresAt > now + 10 * 60_000
  ) return null;
  return { id: job.id, kind: "synthesize", profileId: OFFICIAL_PROFILE_ID,
    text: job.text.trim(), expiresAt: job.expiresAt };
}
export function voiceJobResult(job: VoiceJob, audioBytes: number) {
  if (!Number.isSafeInteger(audioBytes) || audioBytes < 44 || audioBytes > 3_000_000)
    throw Error("VOICE_JOB_INVALID_AUDIO");
  return { jobId: job.id, profileId: OFFICIAL_PROFILE_ID, status: "completed" as const, audioBytes };
}
