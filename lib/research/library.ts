import { readJsonBounded } from "../abacus/hub";
import { publicResearchQuery } from "../cognitive/request-intent";
import { clean, publicHref } from "../holo/validation";
export type LibraryProvider = "crossref" | "openlibrary";
export type LibraryItem = {
  title: string;
  authors: string;
  year: string;
  href: string;
};
export function libraryIntent(
  message: string,
): { provider: LibraryProvider; query: string } | null {
  const q = publicResearchQuery(message);
  if (!q) return null;
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const provider =
    /\b(artigos|estudos cientificos|papers|pesquisas cientificas|crossref)\b/.test(
      n,
    )
      ? "crossref"
      : /\b(livros|bibliografia|open library)\b/.test(n)
        ? "openlibrary"
        : null;
  if (!provider) return null;
  const query = q
    .replace(
      /^(?:artigos(?: cient[ií]ficos)?|estudos cient[ií]ficos|papers|pesquisas cient[ií]ficas|livros|bibliografia)\s+(?:sobre|de)\s+/i,
      "",
    )
    .slice(0, 160);
  return query.length > 2 ? { provider, query } : null;
}
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
export async function searchLibrary(
  provider: LibraryProvider,
  query: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<LibraryItem[]> {
  if (
    !["crossref", "openlibrary"].includes(provider) ||
    !query.trim() ||
    query.length > 160
  )
    throw Error("INVALID_LIBRARY_QUERY");
  const url = new URL(
    provider === "crossref"
      ? "https://api.crossref.org/works"
      : "https://openlibrary.org/search.json",
  );
  if (provider === "crossref") {
    url.searchParams.set("query.bibliographic", query);
    url.searchParams.set("rows", "4");
    url.searchParams.set("select", "DOI,title,author,published,URL");
  } else {
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "4");
    url.searchParams.set("fields", "key,title,author_name,first_publish_year");
    url.searchParams.set("lang", "pt");
  }
  const data = obj(
    await readJsonBounded(
      await fetcher(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "JarvisKiro/1.0 (https://github.com/kiroaventureiro/jarvis-kiro-)",
          Accept: "application/json",
        },
        redirect: "error",
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
          : AbortSignal.timeout(10000),
      }),
      400000,
    ),
  );
  const rows = provider === "crossref" ? obj(data.message).items : data.docs;
  if (!Array.isArray(rows)) throw Error("INVALID_LIBRARY_RESPONSE");
  return rows.slice(0, 4).flatMap((v) => {
    const r = obj(v),
      title = clean(
        provider === "crossref" && Array.isArray(r.title)
          ? r.title[0]
          : r.title,
        180,
      );
    let href: string | undefined,
      authors = "",
      year = "";
    if (provider === "crossref") {
      const doi = typeof r.DOI === "string" ? r.DOI : "";
      if (/^10\.\d{4,9}\/[^\s<>]{1,180}$/.test(doi))
        href = publicHref("https://doi.org/" + doi);
      authors = Array.isArray(r.author)
        ? r.author
            .slice(0, 3)
            .map((a) => {
              const x = obj(a);
              return clean(x.given, 35) + " " + clean(x.family, 45);
            })
            .join(", ")
        : "";
      const dates = obj(r.published)["date-parts"];
      if (
        Array.isArray(dates) &&
        Array.isArray(dates[0]) &&
        typeof dates[0][0] === "number"
      )
        year = String(dates[0][0]);
    } else {
      const key = typeof r.key === "string" ? r.key : "";
      if (/^\/works\/OL\d+W$/.test(key)) href = "https://openlibrary.org" + key;
      else if (/^OL\d+W$/.test(key))
        href = "https://openlibrary.org/works/" + key;
      authors = Array.isArray(r.author_name)
        ? r.author_name
            .slice(0, 3)
            .map((a) => clean(a, 70))
            .join(", ")
        : "";
      year =
        typeof r.first_publish_year === "number"
          ? String(r.first_publish_year)
          : "";
    }
    return title && href ? [{ title, authors, year, href }] : [];
  });
}
export class PublicLibrary {
  private cache = new Map<string, { at: number; items: LibraryItem[] }>();
  private recent: number[] = [];
  constructor(private fetcher: typeof fetch = fetch) {}
  async search(provider: LibraryProvider, query: string, signal?: AbortSignal) {
    if (signal?.aborted) throw signal.reason;
    const id = provider + ":" + query,
      now = Date.now(),
      cached = this.cache.get(id);
    if (cached && now - cached.at < 300000) return cached.items;
    this.recent = this.recent.filter((t) => now - t < 60000);
    if (this.recent.length >= 8) throw Error("LIBRARY_RATE_LIMIT");
    this.recent.push(now);
    const items = await searchLibrary(provider, query, signal, this.fetcher);
    if (this.cache.size >= 30)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(id, { at: now, items });
    return items;
  }
}
