/** Migration is prepared, never enabled by an untrusted request or a silent fallback. */
export function voiceSessionPolicy(env: Record<string, string | undefined>) {
  const model = env.JARVIS_OPENAI_VOICE_MODEL || "gpt-realtime";
  if (!["gpt-realtime", "gpt-realtime-2.1"].includes(model))
    throw Error("VOICE_MODEL_NOT_ALLOWED");
  return {
    model,
    audio: {
      input: {
        turn_detection: {
          type: "server_vad",
          create_response: true,
          // Prevent assistant audio from triggering an unintended interruption.
          interrupt_response: false,
        },
      },
      output: { voice: "marin" },
    },
  };
}
