export type AssistantState =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "responding"
  | "error";
export type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
};
export type RealtimeEvent = {
  type: string;
  item_id?: string;
  response_id?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
  response?: {
    status?: string;
    status_details?: { error?: { message?: string } };
  };
};
export function eventState(type: string): AssistantState | null {
  if (type === "input_audio_buffer.speech_started") return "listening";
  if (
    type === "input_audio_buffer.speech_stopped" ||
    type === "response.created"
  )
    return "processing";
  if (
    [
      "response.output_audio_transcript.delta",
      "response.audio_transcript.delta",
      "response.output_text.delta",
      "response.text.delta",
      "output_audio_buffer.started",
    ].includes(type)
  )
    return "responding";
  if (
    type === "output_audio_buffer.stopped" ||
    type === "output_audio_buffer.cleared"
  )
    return "idle";
  if (type === "error") return "error";
  return null;
}
export function appendTranscript(
  items: TranscriptEntry[],
  id: string,
  role: TranscriptEntry["role"],
  text: string,
  replace = false,
) {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return [...items, { id, role, text }];
  return items.map((item, i) =>
    i === index ? { ...item, text: replace ? text : item.text + text } : item,
  );
}
