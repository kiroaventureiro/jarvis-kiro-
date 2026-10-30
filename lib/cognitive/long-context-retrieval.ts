/** Bounded, provider-independent context selection. No storage, API keys or raw logging. */
export type ContextFragment = {
  id: string;
  project: string;
  source: string;
  content: string;
  updatedAt?: string;
};
export type RankedFragment = ContextFragment & { score: number };
const terms = (s: string): string[] =>
  [...new Set(s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]{3,}/g) ?? [])];

export function rankContextFragments(
  query: string,
  fragments: readonly ContextFragment[],
  options: { project?: string; maxFragments?: number; maxChars?: number } = {},
): RankedFragment[] {
  const keywords = terms(query).slice(0, 64);
  if (!keywords.length) return [];
  const selectedProject = options.project?.trim().toLocaleLowerCase("pt-BR");
  const maxFragments = Math.max(1, Math.min(options.maxFragments ?? 6, 20));
  let remaining = Math.max(1, Math.min(options.maxChars ?? 12000, 60000));
  const seen = new Set<string>();
  return fragments
    .filter((f) => f.id && f.content && (!selectedProject || f.project.toLocaleLowerCase("pt-BR") === selectedProject))
    .map((f) => {
      const haystack = terms(f.project + " " + f.source + " " + f.content.slice(0, 30000));
      const present = new Set(haystack);
      const score = keywords.reduce((n, term) => n + (present.has(term) ? 1 : 0), 0);
      return { ...f, score };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter((f) => { if (seen.has(f.id)) return false; seen.add(f.id); return true; })
    .slice(0, maxFragments)
    .map((f) => {
      const content = f.content.slice(0, remaining);
      remaining -= content.length;
      return { ...f, content };
    })
    .filter((f) => f.content.length > 0);
}
