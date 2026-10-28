import type { QueryRecord, Evidence } from "./types";
import type { HoloScene, HoloModule } from "../holo/types";
import { spokenExplanation } from "./narration";
export function synthesize(
  record: QueryRecord,
  previous?: QueryRecord,
  remembered = false,
) {
  const e = record.evidence,
    verified = e.filter((x) => x.status === "verified"),
    failed = e.filter((x) => x.status === "failed");
  const introduction = remembered
    ? "Retomando a consulta anterior, no horário registrado; não fiz uma nova consulta."
    : "Consultei os recursos autorizados agora.";
  const finding = (x: Evidence) =>
    x.resourceName + " no " + x.provider + ": " + x.observation.summary;
  let comparison = "";
  if (previous) {
    const comparable = e.flatMap((x) => {
      const old = previous.evidence.find(
        (o) =>
          o.provider === x.provider &&
          o.resource === x.resource &&
          o.operation === x.operation,
      );
      if (!old || old.status !== "verified" || x.status !== "verified")
        return [];
      const keys = Object.keys(x.observation.facts).filter(
        (k) =>
          typeof x.observation.facts[k] === "number" &&
          typeof old.observation.facts[k] === "number",
      );
      return keys.map(
        (k) =>
          x.provider +
          " · " +
          k +
          ": antes " +
          old.observation.facts[k] +
          ", depois " +
          x.observation.facts[k],
      );
    });
    comparison = comparable.length
      ? "Comparação das amostras: " +
        comparable.join("; ") +
        ". As consultas têm horários distintos; mudanças de amostra não comprovam regressão."
      : "Não há duas amostras verificadas e comparáveis para confirmar uma mudança.";
  }
  const problems = e.flatMap((x) =>
    x.observation.signals.map((s) => x.provider + ": " + s),
  );
  const limits = [
    ...new Set([...record.limits, ...e.flatMap((x) => x.observation.limits)]),
  ];
  const next = problems.length
    ? "Próximo passo: consultar os detalhes do build ou teste indicado e relacioná-los à mesma versão do código antes de propor correções."
    : failed.length
      ? "Próximo passo: revisar a categoria da falha de consulta e repetir apenas a operação afetada."
      : "Próximo passo: confirmar testes, comportamento do aplicativo e permissões antes de concluir que o projeto está saudável.";
  const detail = record.intent.depth === "brief" ? e.slice(0, 2) : e;
  const text = spokenExplanation(
    [
      introduction,
      ...detail.map(finding),
      comparison,
      problems.length
        ? "Sinais que merecem atenção: " + problems.join(" ")
        : "",
      record.intent.depth === "brief"
        ? "Uma leitura concluída não comprova saúde do projeto."
        : "Limites: " + limits.join(" "),
      next,
    ]
      .filter(Boolean)
      .join(" "),
  );
  const modules: HoloModule[] = [
    {
      id: "findings",
      kind: "report",
      title: remembered ? "Evidências anteriores" : "Evidências desta consulta",
      summary: introduction,
      items: detail.slice(0, 8).map((x) => ({
        label: x.provider + " · " + x.resourceName,
        detail: x.observation.summary,
      })),
      body: e
        .map((x) =>
          [
            x.provider,
            x.resourceName,
            x.operation,
            new Date(x.at).toLocaleString("pt-BR"),
            x.status,
            x.observation.summary,
            ...x.observation.limits,
          ].join(" | "),
        )
        .join("\n"),
    },
  ];
  if (comparison)
    modules.push({
      id: "comparison",
      kind: "compare",
      title: "Comparação temporal",
      columns: [
        {
          label: "Consulta anterior",
          points: previous
            ? [
                new Date(previous.at).toLocaleString("pt-BR"),
                ...previous.evidence.slice(0, 3).map(finding),
              ]
            : ["Sem amostra anterior comparável"],
        },
        {
          label: "Consulta selecionada",
          points: [new Date(record.at).toLocaleString("pt-BR"), comparison],
        },
      ],
    });
  if (record.intent.depth !== "brief")
    modules.push({
      id: "interpretation",
      kind: "report",
      title: "Interpretação e próximos passos",
      summary: problems.length
        ? "Sinais observados; causas ainda não comprovadas."
        : "Não há comprovação de saúde completa.",
      items: [
        {
          label: "O que merece atenção",
          detail:
            problems.join(" ") ||
            "Nenhuma causa de defeito comprovada pelas operações disponíveis.",
        },
        {
          label: "O que falta examinar",
          detail:
            limits.join(" ").slice(0, 1800) || "Revisão técnica adicional.",
        },
        { label: "Próximo passo", detail: next },
      ],
      body: [comparison, ...limits, next].filter(Boolean).join("\n"),
    });
  const visual: HoloScene = {
    version: 1,
    id: "jk-cognitive-" + record.id,
    title: "Análise fundamentada do projeto",
    mode: "technical",
    createdAt: record.at,
    source: {
      kind: "connector",
      label: remembered
        ? "Registro anterior, sem nova consulta"
        : "Operações autorizadas · evidências verificadas e falhas identificadas",
      checkedAt: record.at,
    },
    modules,
    narration: text,
  };
  return {
    text,
    visual,
    cognitive: {
      recordId: record.id,
      temporal: remembered ? "previous" : "current",
      evidence: e,
      limits,
    },
    model: "jk-cognitive",
    provider: "local_operational" as const,
    usage: null,
  };
}
