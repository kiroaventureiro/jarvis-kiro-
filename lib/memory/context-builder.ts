import { selectMemoryTopics, type MemoryTopic } from "./topic-selector";

export type MemoryContext = {
  context: string;
  topicIds: string[];
  usedCharacters: number;
};

/**
 * Build an explicitly bounded, untrusted context fragment from already
 * authorized and decrypted topics. Storage and model orchestration own access.
 */
export function buildMemoryContext(
  question: string,
  topics: readonly MemoryTopic[],
  maxCharacters = 650,
): MemoryContext {
  const cap = Number.isFinite(maxCharacters)
    ? Math.max(0, Math.min(1200, Math.floor(maxCharacters)))
    : 0;
  if (cap < 40) return { context: "", topicIds: [], usedCharacters: 0 };
  const matches = selectMemoryTopics(question, topics, { limit: 3, maxChars: 300 });
  const lines: string[] = [];
  const topicIds: string[] = [];
  let remaining = cap;
  for (const topic of matches) {
    // Delimit retrieved memory so its content is never treated as instructions.
    const safeSummary = topic.summary.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim();
    if (!safeSummary) continue;
    const prefix = "Assunto " + topic.id + ": ";
    if (remaining <= prefix.length + 12) break;
    const line = prefix + safeSummary.slice(0, remaining - prefix.length);
    lines.push(line);
    topicIds.push(topic.id);
    remaining -= line.length + 1;
  }
  const context = lines.join("\n");
  return { context, topicIds, usedCharacters: context.length };
}
