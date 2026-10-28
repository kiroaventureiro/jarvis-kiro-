export type CommonsImage = {
  title: string;
  url: string;
  sourceHref: string;
  author: string;
  license: string;
  licenseHref: string;
  nature: "photograph" | "illustration" | "reproduction" | "reference";
  checkedAt: string;
};
type Fetch = typeof fetch;
const UA =
  "JK-JarvisKiro/3.0 (https://github.com/kiroaventureiro/jarvis-kiro-)";
const plain = (v: unknown, n = 260) =>
  typeof v === "string"
    ? v
        .replace(/<[^>]*>/g, " ")
        .replace(
          /&(?:nbsp|amp|quot|lt|gt);/g,
          (x) =>
            ({
              "&nbsp;": " ",
              "&amp;": "&",
              "&quot;": '"',
              "&lt;": "<",
              "&gt;": ">",
            })[x] || " ",
        )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, n)
    : "";
export function commonsTitle(v: unknown) {
  return typeof v === "string" &&
    /^File:[^|\r\n<>]{1,230}\.(?:jpe?g|png|webp|gif)$/i.test(v)
    ? v
    : undefined;
}
export function commonsUpload(v: unknown) {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" &&
      ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(u.hostname) &&
      u.pathname.startsWith("/wikipedia/commons/") &&
      !u.username &&
      !u.password &&
      !u.port &&
      /\.(?:png|jpe?g|webp|gif)$/i.test(u.pathname)
      ? ((u.search = ""), u.href)
      : undefined;
  } catch {
    return;
  }
}
function permittedLicense(license: string, href: string) {
  try {
    const u = new URL(href);
    if (u.username || u.password || u.port || u.protocol !== "https:")
      return false;
    if (/^(Public domain|PD)$/i.test(license))
      return (
        href === "https://commons.wikimedia.org/wiki/Commons:Public_domain" ||
        (u.hostname === "creativecommons.org" &&
          /^\/publicdomain\/mark\/1\.0\/?$/.test(u.pathname))
      );
    if (u.hostname !== "creativecommons.org") return false;
    if (/^CC0/i.test(license))
      return /^\/publicdomain\/zero\/1\.0\/?$/.test(u.pathname);
    const path =
      /^\/licenses\/(by(?:-sa)?)\/[1-4]\.[05](?:\/[a-z]{2})?(?:\/deed\.[a-z_-]+)?\/?$/i.exec(
        u.pathname,
      );
    return !!path && path[1] === (/BY-SA/i.test(license) ? "by-sa" : "by");
  } catch {
    return false;
  }
}
export function parseCommonsPage(page: any): CommonsImage | null {
  const title = commonsTitle(page?.title),
    info = page?.imageinfo?.[0],
    meta = info?.extmetadata;
  if (!title || !info || !meta) return null;
  const value = (key: string) => plain(meta[key]?.value, 1200),
    license = value("LicenseShortName"),
    licenseHref = (
      value("LicenseUrl") ||
      (/^(Public domain|PD)$/i.test(license)
        ? "https://commons.wikimedia.org/wiki/Commons:Public_domain"
        : "")
    ).replace(/^http:/, "https:"),
    url = commonsUpload(info.thumburl || info.url),
    description = [title, value("ImageDescription"), value("Categories")].join(
      " ",
    );
  if (
    !url ||
    !/^(?:CC BY(?:-SA)?(?: [1-4](?:\.0)?(?: [a-z]{2})?)?|CC0(?: 1\.0)?|Public domain|PD)$/i.test(
      license,
    ) ||
    !permittedLicense(license, licenseHref)
  )
    return null;
  if (
    /AI.generated|generative.AI|stable.diffusion|midjourney|DALL.E|intelig[eê]ncia artificial/i.test(
      description,
    )
  )
    return null;
  const author = value("Artist") || value("Attribution");
  if (!author) return null;
  const nature = /photograph|fotograf|photography/i.test(description)
    ? "photograph"
    : /painting|pintura|engraving|gravura|manuscript|manuscrito/i.test(
          description,
        )
      ? "reproduction"
      : /illustration|ilustra[cç]|drawing|desenho/i.test(description)
        ? "illustration"
        : "reference";
  return {
    title,
    url,
    sourceHref:
      "https://commons.wikimedia.org/wiki/" +
      encodeURIComponent(title.replaceAll(" ", "_")),
    author: author.slice(0, 300),
    license,
    licenseHref,
    nature,
    checkedAt: new Date().toISOString(),
  };
}
export class CommonsResearch {
  private cache = new Map<string, { until: number; image: CommonsImage }>();
  private calls: number[] = [];
  constructor(
    private request: Fetch = fetch,
    private now = () => Date.now(),
  ) {}
  private admit() {
    this.calls = this.calls.filter((t) => this.now() - t < 60000);
    if (this.calls.length >= 18)
      throw Error(
        "A pesquisa visual atingiu um limite temporário. Aguarde um minuto.",
      );
    this.calls.push(this.now());
  }
  private async metadata(params: Record<string, string>, signal?: AbortSignal) {
    this.admit();
    const u = new URL("https://commons.wikimedia.org/w/api.php");
    u.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "960",
      ...params,
    }).toString();
    const response = await this.request(u, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10000)])
        : AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!response.ok)
      throw Error("A fonte de imagens está temporariamente indisponível.");
    const reader = response.body?.getReader();
    if (!reader) throw Error("Metadados de imagem ausentes.");
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 1500000)
          throw Error("Metadados de imagem excederam o limite.");
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const data = JSON.parse(text);
    if (data.error) throw Error("A fonte não concluiu a pesquisa de imagens.");
    return Array.isArray(data.query?.pages) ? data.query.pages : [];
  }
  private async verify(page: any, signal?: AbortSignal) {
    const image = parseCommonsPage(page);
    if (!image) return null;
    const response = await this.request(image.url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(7000)])
        : AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (
      !response.ok ||
      !/^image\/(jpeg|png|webp|gif)(?:;|$)/i.test(
        response.headers.get("content-type") || "",
      )
    )
      return null;
    this.cache.set(image.title, { image, until: this.now() + 300000 });
    if (this.cache.size > 40)
      this.cache.delete(this.cache.keys().next().value!);
    return image;
  }
  async search(query: string, signal?: AbortSignal) {
    const q = plain(query, 160);
    if (
      /(?:gh[pousr]_|github_pat_|sk-(?:proj-)?|sb_secret_)[a-zA-Z0-9_-]{10,}/.test(
        q,
      )
    )
      throw Error("Não inclua credenciais em uma pesquisa pública.");
    if (!q || q.length < 2) throw Error("Informe o assunto da imagem.");
    const pages = await this.metadata(
        { generator: "search", gsrsearch: q, gsrnamespace: "6", gsrlimit: "5" },
        signal,
      ),
      images: CommonsImage[] = [];
    for (const page of pages) {
      if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
      try {
        const image = await this.verify(page, signal);
        if (image) images.push(image);
      } catch (e) {
        if (signal?.aborted) throw e;
      }
      if (images.length >= 3) break;
    }
    return images;
  }
  async image(title: string, signal?: AbortSignal) {
    const safe = commonsTitle(title);
    if (!safe) throw Error("Referência de imagem inválida.");
    const prior = this.cache.get(safe);
    if (prior && prior.until > this.now()) return prior.image;
    const pages = await this.metadata({ titles: safe }, signal);
    return pages[0] ? this.verify(pages[0], signal) : null;
  }
}
export function imageSearchIntent(message: string) {
  const m = message.match(
    /^(?:jarvis[, ]+|jk[, ]+)?(?:mostre|busque|pesquise|procure|encontre|exiba)\s+(?:uma?\s+|algumas?\s+)?(?:imagens?|fotos?|fotografias?|retratos?)\s+(?:rea(?:l|is)\s+)?(?:de|do|da|sobre)\s+(.+)$/i,
  );
  if (!m) return null;
  const query = plain(m[1], 160);
  return query.replace(/[?!.,]+$/, "").trim() || null;
}
