import { appendTranscript, type TranscriptEntry } from "./jarvis-realtime";
export function appendSpokenReply(
  items: TranscriptEntry[],
  id: string,
  text: string,
  replace = false,
  available = true,
) {
  return appendTranscript(items, id, "assistant", text, replace).map((item) =>
    item.id === id
      ? { ...item, presentation: "speech" as const, speechAvailable: available }
      : item,
  );
}
export function speechUnavailable(
  items: TranscriptEntry[],
  ids: ReadonlySet<string>,
) {
  return items.map((item) =>
    ids.has(item.id) && item.presentation === "speech"
      ? { ...item, speechAvailable: false }
      : item,
  );
}
export function visibleResponses(
  items: TranscriptEntry[],
  desktop: boolean,
  muted: boolean,
) {
  return items.filter(
    (item) =>
      !(
        desktop &&
        !muted &&
        item.role === "assistant" &&
        item.presentation === "speech" &&
        item.speechAvailable
      ),
  );
}
