/** Pure, offline topic selector. No storage, embeddings, network or provider calls. */
export type MemoryTopic = {
  id: string;
  title: string;
  summary: string;
  updatedAt?: string;
  tags?: string[];
  sensitive?: boolean;
};
export type SelectedTopic = { id: string; score: number; summary: string };

const words = (text: string): string[] =>
  (text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").match(/[a-z0-9]{3,}/g) || [])
    .filter((word) => !new Set(["para", "com", "uma", "que", "isso", "esse", "esta", "sobre", "como", "qual", "quero", "voce", "meu", "minha"]).has(word));

/** Topics must already be authorized and decrypted by the server's storage layer. */
export function selectMemoryTopics(
  query: string,
  topics: readonly MemoryTopic[],
  options: { limit?: number; maxChars?: number } = {},
): SelectedTopic[] {
  const limit = Math.max(0, Math.min(3, Math.floor(options.limit ?? 2)));
  const maxChars = Math.max(0, Math.min(600, Math.floor(options.maxChars ?? 300)));
  if (!query.trim() || !limit || !maxChars) return [];
  const q = new Set(words(query));
  if (!q.size) return [];
  const seen = new Set<string>();
  const scored: SelectedTopic[] = [];
  for (const topic of topics.slice(0, 200)) {
    if (!topic || topic.sensitive || !/^[a-zA-Z0-9_-]{1,80}$/.test(topic.id) || seen.has(topic.id)) continue;
    seen.add(topic.id);
    const title = new Set(words(topic.title || ""));
    const tags = new Set(words((topic.tags || []).slice(0, 12).join(" ")));
    const summary = new Set(words(topic.summary || ""));
    let score = 0;
    for (const term of q) {
      if (title.has(term)) score += 4;
      if (tags.has(term)) score += 3;
      if (summary.has(term)) score += 1;
    }
    if (score > 0) scored.push({ id: topic.id, score, summary: (topic.summary || "").slice(0, maxChars) });
  }
  return scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}
