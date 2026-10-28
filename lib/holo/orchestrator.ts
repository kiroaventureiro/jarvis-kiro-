import { BRAZIL_CHAPTERS, BRAZIL_EXPLANATION } from "./brazil-chapters";
import { geographyScene } from "./geography";
import type { HoloScene, HoloModule, HoloSource } from "./types";
import { clean, normalizeScene, publicHref, mediaHref } from "./validation";
type Reply = {
  text: string;
  visual?: unknown;
  result?: unknown;
  operational?: unknown;
};
const object = (x: unknown): Record<string, any> =>
  x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, any>)
    : {};
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const idFor = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return "holo-" + (h >>> 0).toString(16);
};
function scene(
  title: string,
  mode: HoloScene["mode"],
  source: HoloSource,
  modules: HoloModule[],
  seed = title,
): HoloScene {
  return {
    version: 1,
    id: idFor(seed),
    title: clean(title, 110),
    mode,
    createdAt: new Date().toISOString(),
    source,
    modules,
  };
}
export function responsePoints(text: string) {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÁ-Ú])/u)
    .map((x) =>
      x
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter((x) => x.length > 8)
    .slice(0, 6)
    .map((x) => {
      const colon = x.indexOf(":");
      return colon > 0 && colon < 80
        ? {
            label: clean(x.slice(0, colon), 80),
            detail: clean(x.slice(colon + 1).trim(), 360),
          }
        : {
            label: clean(x, 95),
            detail: x.length > 95 ? clean(x.slice(95), 260) : "",
          };
    });
}
export function brazilReferenceScene() {
  return scene(
    "Brasil · território e história",
    "explanation",
    {
      kind: "reference",
      label: "Referência preparada · não é pesquisa ao vivo",
      href: "https://atlas.fgv.br/",
    },
    [
      {
        id: "territory",
        kind: "map",
        title: "Território brasileiro",
        region: "BR",
        caption:
          "Malha simplificada do IBGE. Selecione uma unidade da federação para explorar.",
      },
      {
        id: "history",
        kind: "timeline",
        title: "Marcos da história",
        events: [
          {
            when: "Antes de 1500",
            label: "Povos originários",
            detail:
              "O território já era habitado por diversos povos indígenas; a história não começa com a chegada europeia.",
          },
          {
            when: "1500",
            label: "Chegada da expedição portuguesa",
            detail:
              "Marco do início da colonização portuguesa; não representa o início da ocupação humana.",
            href: "https://atlas.fgv.br/",
          },
          {
            when: "1822",
            label: "Independência",
            detail:
              "Ruptura política com Portugal e formação do Império do Brasil.",
            href: "https://atlas.fgv.br/",
          },
          {
            when: "1889",
            label: "Proclamação da República",
            detail: "Mudança do regime monárquico para o republicano.",
            href: "https://atlas.fgv.br/",
          },
          {
            when: "1988",
            label: "Constituição cidadã",
            detail: "Promulgada em 5 de outubro de 1988.",
            href: "https://www2.camara.leg.br/atividade-legislativa/legislacao/constituicao1988",
          },
        ],
      },
      {
        id: "reading",
        kind: "report",
        title: "Roteiro de exploração",
        summary: "Uma leitura por períodos, território e fontes.",
        items: [
          {
            label: "Território",
            detail:
              "Explore o mapa atual; as fronteiras variaram ao longo da história.",
          },
          {
            label: "Transformações",
            detail:
              "Observe colonização, independência, república e redemocratização.",
          },
          {
            label: "Fontes",
            detail:
              "Atlas Histórico do Brasil, FGV; Constituição de 1988, Câmara dos Deputados.",
          },
        ],
      },
    ],
    "brazil-reference-v1",
  );
}
export function mediaReferenceScene(message: string): HoloScene | null {
  const n = norm(message);
  if (!/mostr|exib|abr[ai]|reprodu|video|imagem|midia/.test(n)) return null;
  const urls = [...message.matchAll(/https:\/\/[^\s<>"']+/g)]
    .map((m) => mediaHref(m[0].replace(/[),;]+$/, "")))
    .filter((v): v is string => !!v)
    .slice(0, 4);
  if (!urls.length) return null;
  return scene(
    "Mídia de referência",
    "creative",
    {
      kind: "reference",
      label: "URLs fornecidas pelo usuário · carregamento manual",
    },
    [
      {
        id: "media",
        kind: "media",
        title: "Imagens e vídeos",
        items: urls.map((url, i) => ({
          id: "asset-" + i,
          type: /\.(mp4|webm)$/i.test(new URL(url).pathname)
            ? "video"
            : "image",
          label: clean(new URL(url).pathname.split("/").at(-1) || "Mídia", 100),
          url,
          caption:
            "Referência fornecida. Não foi gerada nem analisada automaticamente.",
        })),
      },
    ],
    message,
  );
}

export function localVisualReference(message: string) {
  const media = mediaReferenceScene(message);
  if (media)
    return {
      text: "Preparei a mídia que você indicou. Use o painel para carregá-la e reproduzi-la. Esta ação exibe a referência; não realiza geração nem análise audiovisual automática.",
      model: "jk-media-reference",
      provider: "local_operational" as const,
      usage: null,
      visual: media,
    };
  const n = norm(message);
  if (!/(historia|historico)/.test(n) || !/brasil|brasileir/.test(n)) {
    const geo = /mapa|mundi|geografia|territorio|localiz|onde fica/.test(n)
      ? geographyScene(message)
      : null;
    if (geo)
      return {
        text:
          geo.modules[0]?.kind === "map" && geo.modules[0].region === "BR"
            ? "Preparei um mapa regional do Brasil com limites estaduais atuais do IBGE. Vou destacar a região indicada; não é um mapa de ruas nem uma reconstrução de fronteiras históricas."
            : "Preparei um mapa-múndi interativo. Você pode selecionar países, aproximar e abrir uma localização no Google Maps. A cartografia é uma referência geográfica; dados e indicadores atuais precisam de uma fonte específica.",
        model: "jk-geography",
        provider: "local_operational" as const,
        usage: null,
        visual: geo,
      };
    return null;
  }
  const detailed = /complet|aprofund|detalhad|explique/i.test(message);
  const visual = brazilReferenceScene();
  if (detailed) {
    const timeline = visual.modules.find((m) => m.kind === "timeline");
    if (timeline?.kind === "timeline") timeline.events = BRAZIL_CHAPTERS;
    const report = visual.modules.find((m) => m.kind === "report");
    if (report?.kind === "report") {
      report.body = BRAZIL_EXPLANATION;
      report.summary =
        "Panorama ampliado por capítulos; limites estaduais atuais são apenas referência de localização.";
    }
    visual.narration = BRAZIL_EXPLANATION;
    visual.id = "brazil-reference-chapters-v3";
  }
  return {
    text: detailed
      ? BRAZIL_EXPLANATION
      : "O território brasileiro já era habitado por diversos povos indígenas antes da chegada da expedição portuguesa, em 1500. Entre os marcos estão a independência, em 1822, a proclamação da República, em 1889, e a Constituição de 1988. Projetei um mapa e uma linha do tempo de referência. Você pode selecionar os estados e explorar cada período.",
    model: "jk-curated-reference",
    provider: "local_operational" as const,
    usage: null,
    visual,
  };
}
export function operationalScene(value: unknown): HoloScene | null {
  const snapshot = object(value);
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.integrations))
    return null;
  const items = snapshot.integrations.slice(0, 14).map((raw: unknown) => {
    const r = object(raw);
    return {
      id: r.id,
      label: r.name,
      state:
        snapshot.nativeRegistryState === "unavailable" &&
        ["github", "vercel", "supabase-admin"].includes(r.id)
          ? "not_consulted"
          : r.state,
      detail: r.note,
      checkedAt: r.checkedAt || undefined,
    };
  });
  return normalizeScene(
    scene(
      "Ecossistema KIRO",
      "technical",
      {
        kind: "operational",
        label: "Registro operacional deste ambiente",
        checkedAt: snapshot.generatedAt,
      },
      [
        {
          id: "connections",
          kind: "connections",
          title: "Conexões e permissões",
          items,
        },
      ],
    ),
  );
}
export function planScene(value: unknown): HoloScene | null {
  const p = object(value);
  if (!/^[-\w]{1,90}$/.test(p.id) || !Array.isArray(p.steps)) return null;
  const done = p.steps.filter((s: any) => s.status === "done").length,
    failed = p.steps.filter((s: any) =>
      ["failed", "uncertain"].includes(s.status),
    ).length,
    pending = p.steps.length - done - failed;
  const modules: HoloModule[] = [
    {
      id: "diagnostic",
      kind: "report",
      title: "Diagnóstico e prioridades",
      summary:
        "Estado verificado do plano: " +
        clean(p.status, 40) +
        ". Resultados limitados às consultas realizadas.",
      items: p.steps.slice(0, 6).map((s: any) => ({
        label: clean(s.action?.provider + " · " + s.action?.operation, 90),
        detail: clean(
          s.status +
            (s.error ? " · " + s.error : "") +
            (s.result ? " · " + JSON.stringify(s.result).slice(0, 240) : ""),
          350,
        ),
      })),
      href: "/conexoes#plan-" + p.id,
    },
    {
      id: "execution",
      kind: "metrics",
      title: "Etapas do plano",
      unit: "etapas · não é medição de performance do site",
      style: "bars",
      values: [
        { label: "Concluídas", value: done },
        { label: "Pendentes", value: pending },
        { label: "Falhas/incertas", value: failed },
      ],
    },
  ];
  return normalizeScene(
    scene(
      clean(p.title, 110),
      "technical",
      {
        kind: "connector",
        label: "Resultados das operações autorizadas",
        href: "/conexoes#plan-" + p.id,
      },
      modules,
      p.id,
    ),
  );
}
export function composeScene(message: string, reply: Reply): HoloScene | null {
  const explicit = normalizeScene(reply.visual);
  if (explicit)
    return {
      ...explicit,
      narration: explicit.narration || clean(reply.text, 12000),
    };
  if (reply.operational) {
    const operational = operationalScene(reply.operational);
    if (operational)
      return { ...operational, narration: clean(reply.text, 12000) };
  }
  const text = clean(reply.text, 9000),
    n = norm(message),
    result = object(reply.result),
    href = publicHref(result.href);
  if (result.kind === "connector_plan" && href)
    return scene(
      clean(result.title, 100),
      "technical",
      {
        kind: "connector",
        label: "Plano autorizado · detalhes na Central",
        href,
      },
      [
        {
          id: "diagnostic",
          kind: "report",
          title: "Resultado de desenvolvimento",
          summary:
            "O resultado foi preparado. Abra o plano para verificar etapas, falhas e autorizações.",
          items: [],
          href,
        },
      ],
      String(result.id),
    );
  if (/brasil|brasileir/.test(n) && /(historia|historico)/.test(n))
    return { ...brazilReferenceScene(), narration: clean(reply.text, 12000) };
  if (
    text.length < 70 ||
    /^(oi|ola|bom dia|boa tarde|boa noite|obrigad[oa])(?:[\s,!?.]|$)/.test(n)
  )
    return null;
  const creative = /ideias|roteiro|criativ|video|moodboard|cena/.test(n),
    technical = /diagnost|site|codigo|erro|performance|tecnic/.test(n),
    points = responsePoints(text),
    title = creative
      ? "Direção criativa"
      : technical
        ? "Análise técnica"
        : "Exploração do tema";
  const modules: HoloModule[] = [
    {
      id: "overview",
      kind: "report",
      title: creative
        ? "Ideias e referências"
        : technical
          ? "Diagnóstico resumido"
          : "Pontos em destaque",
      summary: clean(points[0]?.label || title, 160),
      items: points.slice(0, 4),
      body: text,
    },
  ];
  const geo = geographyScene(message);
  if (geo) modules.unshift(geo.modules[0]);
  const dates = [
    ...text.matchAll(
      /(?:^|\n)\s*(\d{4}(?:\s*[-–]\s*\d{4})?)\s*[:—–-]\s*([^\n]+)/g,
    ),
  ]
    .slice(0, 6)
    .map((m) => ({
      when: m[1],
      label: clean(m[2], 90),
      detail:
        "Extraído da resposta; confira a fonte antes de usar como dado verificado.",
    }));
  if (dates.length > 1)
    modules.unshift({
      id: "timeline",
      kind: "timeline",
      title: "Sequência apresentada",
      events: dates,
    });
  const choices = [
    ...text.matchAll(
      /(?:^|\n)\s*(?:Op[cç][aã]o\s+([AB12]))\s*[:—–-]\s*([^\n]+)/gi,
    ),
  ].slice(0, 2);
  if (choices.length === 2)
    modules.unshift({
      id: "comparison",
      kind: "compare",
      title: "Comparar possibilidades",
      columns: choices.map((m) => ({
        label: "Opção " + m[1],
        points: [clean(m[2], 230)],
      })),
    });
  const composed = normalizeScene(
    scene(
      title,
      creative ? "creative" : technical ? "technical" : "explanation",
      {
        kind: "assistant",
        label: "Síntese da resposta · sem verificação externa adicional",
      },
      modules.slice(0, 6),
      message + text,
    ),
  );
  return composed ? { ...composed, narration: clean(reply.text, 12000) } : null;
}
export function attachmentScene(
  text: string,
  files: Array<{ id: string; name: string; image: boolean }>,
): HoloScene | null {
  const modules: HoloModule[] = [
    {
      id: "analysis",
      kind: "report",
      title: "Análise dos anexos",
      summary:
        "Síntese do resultado recebido. Conteúdo dos arquivos é tratado como dado externo.",
      items: responsePoints(clean(text, 9000)).slice(0, 4),
      body: clean(text, 9000),
    },
  ];
  const images = files.filter((f) => f.image).slice(0, 8);
  if (images.length)
    modules.unshift({
      id: "media",
      kind: "media",
      title: "Referências enviadas",
      items: images.map((f) => ({
        id: f.id,
        label: clean(f.name, 120),
        type: "image",
        localId: f.id,
      })),
    });
  return normalizeScene({
    ...scene(
      "Análise multimodal",
      "analysis",
      {
        kind: "attachment",
        label: "Arquivos desta sessão · resultado da análise",
      },
      modules,
      text + files.map((x) => x.id).join(),
    ),
    narration: clean(text, 12000),
  });
}
