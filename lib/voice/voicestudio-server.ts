import "server-only";
import { inspectVoiceStudio, voiceStudioIntent } from "./voicestudio";
export async function answerVoiceStudioQuestion(
  message: string,
  signal?: AbortSignal,
) {
  if (!voiceStudioIntent(message)) return null;
  const studio = await inspectVoiceStudio(process.env, signal);
  return {
    text: studio.note,
    model: "jk-voicestudio",
    usage: null,
    provider: "local_operational" as const,
    studio,
  };
}
