import type { HoloScene, HoloModule, HoloSource } from "./types";
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export const clean = (v: unknown, n = 180) =>
  typeof v === "string"
    ? v
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
        .replace(
          /(?:gh[pousr]_[\w]{10,}|github_pat_[\w]+|sk-(?:proj-)?[\w-]{12,}|sb_secret_[\w-]+|eyJ[\w-]+\.[\w-]+\.[\w-]+)/g,
          "[oculto]",
        )
        .slice(0, n)
    : "";
export function publicHref(v: unknown): string | undefined {
  if (typeof v !== "string" || v.length > 900 || /[\x00-\x20\\]/.test(v))
    return;
  if (
    /^\/(?:conexoes|configuracoes|projetos|diagnostico|resultados)(?:#[\w-]+)?$/.test(
      v,
    )
  )
    return v;
  try {
    const u = new URL(v);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes(".") ||
      /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        u.hostname,
      ) ||
      /\.(?:local|internal|localhost)$/.test(u.hostname) ||
      u.hostname.includes(":")
    )
      return;
    if (
      [...u.searchParams.keys()].some((k) =>
        /token|key|secret|password|auth|code/i.test(k),
      )
    )
      return;
    return u.href;
  } catch {
    return;
  }
}
export function mediaHref(v: unknown) {
  const href = publicHref(v);
  if (!href || !href.startsWith("https://")) return;
  try {
    if (!/\.(png|jpe?g|webp|avif|gif|mp4|webm)$/i.test(new URL(href).pathname))
      return;
    return href;
  } catch {
    return;
  }
}
const list = (v: unknown, max = 8) =>
  Array.isArray(v) && v.length <= max ? v : null;
const date = (v: unknown) =>
  typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v))
    ? v
    : undefined;
export function normalizeScene(value: unknown): HoloScene | null {
  try {
    const v = object(value),
      source = object(v.source),
      modules = list(v.modules, 8),
      id = clean(v.id, 90),
      title = clean(v.title, 110),
      createdAt = date(v.createdAt);
    if (
      v.version !== 1 ||
      !/^[-\w]{1,90}$/.test(id) ||
      !title ||
      !createdAt ||
      !modules?.length ||
      !["explanation", "technical", "creative", "analysis"].includes(
        String(v.mode),
      ) ||
      ![
        "assistant",
        "reference",
        "connector",
        "operational",
        "attachment",
        "research",
      ].includes(String(source.kind)) ||
      !clean(source.label, 200) ||
      JSON.stringify(value).length > 42000
    )
      return null;
    const items: HoloModule[] = [];
    const seen = new Set<string>();
    for (const raw of modules) {
      const m = object(raw),
        base = { id: clean(m.id, 60), title: clean(m.title, 100) };
      if (!/^[-\w]{1,60}$/.test(base.id) || !base.title || seen.has(base.id))
        return null;
      seen.add(base.id);
      if (m.kind === "text") {
        const tags = list(m.tags, 6);
        if (!tags) return null;
        items.push({
          ...base,
          kind: "text",
          text: clean(m.text, 100),
          tags: tags.map((x) => clean(x, 40)).filter(Boolean),
        });
      } else if (m.kind === "map") {
        if (m.region !== "BR" && m.region !== "WORLD") return null;
        items.push({
          ...base,
          kind: "map",
          region: m.region,
          ...(typeof m.focusCountry === "string" &&
          /^[A-Z0-9-]{2,12}$/.test(m.focusCountry)
            ? { focusCountry: m.focusCountry }
            : {}),
          caption: clean(m.caption, 200),
        });
      } else if (m.kind === "timeline") {
        const events = list(m.events, 8);
        if (!events?.length) return null;
        items.push({
          ...base,
          kind: "timeline",
          events: events.map((x) => {
            const e = object(x);
            if (!clean(e.when, 40) || !clean(e.label, 100)) throw Error();
            return {
              when: clean(e.when, 40),
              label: clean(e.label, 100),
              detail: clean(e.detail, 280),
              ...(publicHref(e.href) ? { href: publicHref(e.href) } : {}),
            };
          }),
        });
      } else if (m.kind === "report") {
        const points = list(m.items, 8);
        if (!points) return null;
        items.push({
          ...base,
          kind: "report",
          summary: clean(m.summary, 320),
          items: points.map((x) => {
            const e = object(x);
            return { label: clean(e.label, 100), detail: clean(e.detail, 400) };
          }),
          ...(typeof m.body === "string" ? { body: clean(m.body, 9000) } : {}),
          ...(publicHref(m.href) ? { href: publicHref(m.href) } : {}),
        });
      } else if (m.kind === "media") {
        const assets = list(m.items, 8);
        if (!assets?.length) return null;
        items.push({
          ...base,
          kind: "media",
          items: assets.map((x) => {
            const a = object(x),
              url = mediaHref(a.url),
              localId =
                typeof a.localId === "string" && /^[-\w]{1,90}$/.test(a.localId)
                  ? a.localId
                  : undefined;
            if (
              !["image", "video"].includes(String(a.type)) ||
              (!url && !localId)
            )
              throw Error();
            return {
              id: clean(a.id, 80),
              label: clean(a.label, 120),
              type: a.type as "image" | "video",
              ...(url ? { url } : {}),
              ...(localId ? { localId } : {}),
              caption: clean(a.caption, 200),
            };
          }),
        });
      } else if (m.kind === "compare") {
        const cols = list(m.columns, 2);
        if (cols?.length !== 2) return null;
        items.push({
          ...base,
          kind: "compare",
          columns: cols.map((x) => {
            const c = object(x),
              points = list(c.points, 5);
            if (!points?.length) throw Error();
            return {
              label: clean(c.label, 80),
              points: points.map((p) => clean(p, 240)),
            };
          }),
        });
      } else if (m.kind === "metrics") {
        const values = list(m.values, 12);
        if (
          !values?.length ||
          !["bars", "line", "radar", "rings"].includes(String(m.style))
        )
          return null;
        items.push({
          ...base,
          kind: "metrics",
          unit: clean(m.unit, 50),
          style: m.style as "bars",
          values: values.map((x) => {
            const d = object(x);
            if (
              typeof d.value !== "number" ||
              !Number.isFinite(d.value) ||
              Math.abs(d.value) > 1e12 ||
              !clean(d.label, 60)
            )
              throw Error();
            return {
              label: clean(d.label, 60),
              value: d.value,
              ...(typeof d.period === "string"
                ? { period: clean(d.period, 40) }
                : {}),
            };
          }),
        });
      } else if (m.kind === "connections") {
        const connections = list(m.items, 14);
        if (!connections?.length) return null;
        items.push({
          ...base,
          kind: "connections",
          items: connections.map((x) => {
            const c = object(x);
            if (
              ![
                "not_configured",
                "credentials_configured",
                "connection_validated",
                "operational_authorized",
                "temporarily_unavailable",
                "not_consulted",
              ].includes(String(c.state))
            )
              throw Error();
            return {
              id: clean(c.id, 60),
              label: clean(c.label, 80),
              state: c.state as "not_configured",
              detail: clean(c.detail, 300),
              ...(date(c.checkedAt) ? { checkedAt: date(c.checkedAt) } : {}),
            };
          }),
        });
      } else return null;
    }
    return {
      version: 1,
      id,
      title,
      createdAt,
      mode: v.mode as HoloScene["mode"],
      source: {
        kind: source.kind as HoloSource["kind"],
        label: clean(source.label, 200),
        ...(publicHref(source.href) ? { href: publicHref(source.href) } : {}),
        ...(date(source.checkedAt)
          ? { checkedAt: date(source.checkedAt) }
          : {}),
      },
      modules: items,
      ...(typeof v.narration === "string"
        ? { narration: clean(v.narration, 12000) }
        : {}),
      ...(Array.isArray(v.sources) && v.sources.length <= 8
        ? {
            sources: v.sources.map((raw) => {
              const r = object(raw),
                href = publicHref(r.href),
                checkedAt = date(r.checkedAt);
              if (
                !href ||
                !checkedAt ||
                !["ok", "unavailable", "mismatch"].includes(String(r.status))
              )
                throw Error();
              return {
                label: clean(r.label, 150),
                href,
                checkedAt,
                status: r.status as "ok",
                note: clean(r.note, 300),
              };
            }),
          }
        : {}),
    };
  } catch {
    return null;
  }
}
export function exportScene(scene: HoloScene) {
  return JSON.stringify(
    {
      format: "jk-holographic-result",
      exportedAt: new Date().toISOString(),
      scene,
    },
    null,
    2,
  );
}
export function visibleModules(
  scene: HoloScene,
  active: string[],
  compact = false,
) {
  return scene.modules
    .filter((x) => active.includes(x.id))
    .slice(0, compact ? 1 : 3);
}

export function connectionPresentation(
  state: string,
  checkedAt?: string,
  now = Date.now(),
) {
  if (
    ["operational_authorized", "connection_validated"].includes(state) &&
    (!checkedAt ||
      now - Date.parse(checkedAt) >= 60000 ||
      Date.parse(checkedAt) > now)
  )
    return { state: "credentials_configured", stale: true };
  return { state, stale: false };
}
