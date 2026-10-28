export type DesignSection = {
  title: string;
  text: string;
  kind: "hero" | "cards" | "timeline" | "content";
};
export type DesignSpec = {
  title: string;
  background: string;
  foreground: string;
  accent: string;
  radius: number;
  font: "sans-serif" | "serif" | "monospace";
  sections: DesignSection[];
  source: "brief" | "image" | "html-css";
};
const clean = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/[\u0000-\u001f]/g, " ")
        .trim()
        .slice(0, max)
    : "";
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[a-f0-9]{6}$/i.test(v) ? v : fallback;
export function normalizeDesign(
  value: unknown,
  source: DesignSpec["source"] = "brief",
): DesignSpec {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Estrutura inválida.");
  const d = value as Record<string, unknown>;
  if (!Array.isArray(d.sections) || !d.sections.length || d.sections.length > 8)
    throw Error("Informe de uma a oito regiões.");
  return {
    title: clean(d.title, 80) || "Minha interface",
    background: color(d.background, "#07121f"),
    foreground: color(d.foreground, "#e8f4ff"),
    accent: color(d.accent, "#38d9f5"),
    radius:
      typeof d.radius === "number" && Number.isFinite(d.radius)
        ? Math.min(40, Math.max(0, Math.round(d.radius)))
        : 18,
    font: ["sans-serif", "serif", "monospace"].includes(String(d.font))
      ? (d.font as DesignSpec["font"])
      : "sans-serif",
    sections: d.sections.map((x) => {
      if (!x || typeof x !== "object") throw Error("Região inválida.");
      const s = x as Record<string, unknown>;
      return {
        title: clean(s.title, 90) || "Seção",
        text: clean(s.text, 500),
        kind: ["hero", "cards", "timeline", "content"].includes(String(s.kind))
          ? (s.kind as DesignSection["kind"])
          : "content",
      };
    }),
    source,
  };
}
export function designFromBrief(brief: string): DesignSpec {
  const lines = brief
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);
  return normalizeDesign({
    title: lines[0] || "Minha interface",
    sections: (lines.length > 1
      ? lines.slice(1)
      : ["Apresentação", "Destaques", "Próximos passos"]
    )
      .slice(0, 8)
      .map((text, i) => ({
        title: text.slice(0, 90),
        text,
        kind: i === 0 ? "hero" : i === 1 ? "cards" : "content",
      })),
  });
}
export function parseVisionDesign(raw: string): DesignSpec {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return normalizeDesign(JSON.parse(text), "image");
}
/** Source is read as text; scripts, stylesheets and external resources are never executed. */
export function extractDesign(
  html: string,
  css: string,
): {
  spec: DesignSpec;
  selectors: string[];
  tokens: Record<string, string>;
  limitations: string[];
} {
  if (html.length + css.length > 500000)
    throw Error("O HTML e CSS juntos devem ter até 500 KB.");
  const source = html
    .replace(/<(script|iframe|object|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const styles =
    css +
    "\n" +
    [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
      .map((x) => x[1])
      .join("\n");
  const plain = (s: string) =>
    s
      .replace(/<[^>]*>/g, " ")
      .replace(/&(?:nbsp|amp|lt|gt|quot);/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const headings = [
    ...source.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi),
  ]
    .slice(0, 8)
    .map((x) => plain(x[2]));
  const colors = [...styles.matchAll(/#[a-f\d]{6}\b/gi)].map((x) => x[0]);
  const tokens: Record<string, string> = {};
  for (const m of styles.matchAll(
    /(--[\w-]{1,60})\s*:\s*([^;{}]{1,160})[;}]/g,
  )) {
    if (Object.keys(tokens).length >= 40) break;
    tokens[m[1]] = m[2].trim();
  }
  const selectors = [
    ...new Set(
      [...styles.matchAll(/(?:^|})\s*([^@{}][^{}]{0,150})\s*\{/g)].map((x) =>
        x[1].trim(),
      ),
    ),
  ].slice(0, 40);
  const spec = normalizeDesign(
    {
      title:
        headings[0] ||
        plain(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") ||
        "Design extraído",
      background: colors[0],
      foreground: colors[1],
      accent: colors[2],
      sections: (headings.length ? headings : ["Conteúdo importado"]).map(
        (title, i) => ({
          title,
          text: "Região identificada no código fornecido.",
          kind: i === 0 ? "hero" : "content",
        }),
      ),
    },
    "html-css",
  );
  return {
    spec,
    selectors,
    tokens,
    limitations: [
      "Extração estática de cabeçalhos, cores e variáveis CSS; cores sugeridas exigem revisão.",
      "Não executa JavaScript, não importa recursos externos e não preserva automaticamente animações, React ou WebGL.",
    ],
  };
}
export function wireframe(spec: DesignSpec) {
  return spec.sections
    .map((s) => {
      const lines = [s.kind, "[h2: " + s.title + "]", "[t2: " + s.text + "]"];
      const w = Math.max(...lines.map((x) => x.length)) + 4;
      return [
        "+" + "-".repeat(w - 2) + "+",
        ...lines.map((x) => "| " + x.padEnd(w - 4) + " |"),
        "+" + "-".repeat(w - 2) + "+",
      ].join("\n");
    })
    .join("\n\n");
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function designFiles(
  raw: DesignSpec,
  extraction?: ReturnType<typeof extractDesign>,
): Record<string, string> {
  const d = normalizeDesign(raw, raw.source);
  const css = `:root{--background:${d.background};--foreground:${d.foreground};--accent:${d.accent};--radius:${d.radius}px}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--foreground);font-family:${d.font};line-height:1.6}a{color:var(--accent)}header,main,footer{width:min(1100px,92%);margin:auto}header{padding:24px 0;border-bottom:1px solid var(--accent)}nav{display:flex;gap:18px;flex-wrap:wrap}main{display:grid;gap:24px;padding:40px 0}section{padding:clamp(20px,4vw,48px);border:1px solid var(--accent);border-radius:var(--radius);overflow-wrap:anywhere}.hero{min-height:40vh;display:grid;align-content:center;background:linear-gradient(135deg,transparent,color-mix(in srgb,var(--accent) 15%,transparent))}h1{font-size:clamp(2rem,6vw,4rem)}.cards{display:grid;gap:16px}.timeline{border-left:4px solid var(--accent)}footer{padding:24px 0}@media(prefers-reduced-motion:no-preference){section{animation:enter .5s ease both}@keyframes enter{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}}`;
  const content = d.sections
    .map(
      (s, i) =>
        `<section class="${s.kind}" id="section-${i}"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></section>`,
    )
    .join("\n");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; script-src 'none'; img-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>${esc(d.title)}</title><link rel="stylesheet" href="assets/styles.css"></head><body><header><h1>${esc(d.title)}</h1><nav aria-label="Seções">${d.sections.map((s, i) => `<a href="#section-${i}">${esc(s.title)}</a>`).join(" ")}</nav></header><main>${content}</main><footer>Protótipo gerado pelo JK · revise antes de publicar.</footer></body></html>`;
  const catalog = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(d.title)} — Design System</title><link rel="stylesheet" href="assets/styles.css"></head><body><header><h1>${esc(d.title)} — Design System</h1><nav><a href="index.html">Overview</a><a href="#components">Components</a></nav></header><main id="components"><section><h2>Fundamentos</h2><p>Cores: ${esc(d.background)}, ${esc(d.foreground)}, ${esc(d.accent)}. Fonte: ${d.font}. Raio: ${d.radius}px.</p><pre>${esc(JSON.stringify(extraction?.tokens || d, null, 2))}</pre></section>${content}<section><h2>Origem e limites</h2><p>${esc(extraction?.limitations.join(" ") || "Catálogo dos componentes gerados; revise a fidelidade à referência.")}</p><pre>${esc(extraction?.selectors.join("\n") || ".hero\n.cards\n.timeline\n.content")}</pre></section></main></body></html>`;
  return {
    "index.html": html,
    "assets/styles.css": css,
    "design-system.html": catalog,
    "tokens.json": JSON.stringify(d, null, 2),
    "wireframe.txt": wireframe(d),
    "README.md":
      "# " +
      d.title +
      "\nAbra index.html localmente; design-system.html contém o catálogo.\nOrigem: " +
      d.source +
      ".\nProtótipo estático: não inclui autenticação, backend, serviços conectados ou publicação. Revisar conteúdo, acessibilidade e fidelidade visual.\n",
  };
}
export function previewDocument(files: Record<string, string>) {
  return files["index.html"]
    .replace(/href="#/g, 'href="about:srcdoc#')
    .replace('href="index.html"', 'href="about:srcdoc#"')
    .replace("style-src 'self'", "style-src 'unsafe-inline'")
    .replace(
      '<link rel="stylesheet" href="assets/styles.css">',
      "<style>" + files["assets/styles.css"] + "</style>",
    );
}
