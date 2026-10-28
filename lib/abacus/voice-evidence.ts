import type { HoloScene } from "../holo/types";
type Observation = {
  plan: string;
  remainingCredits: number | null;
  observedAt: string;
  connectedServices: string[];
  activeTasks: string[];
  personalAgents: string[];
};
export type AbacusVoiceEvidence = {
  catalogVerified: boolean;
  checkedAt: string | null;
  modelCount: number | null;
  modelExamples: string[];
  toolsCount: number | null;
  observation: Observation | null;
  observationStale: boolean;
  mediaImplemented: boolean;
  generationVerified: false;
  videoExecution: false;
  agentExecution: false;
  note: string;
};
export function abacusVoiceEvidence(h: {
  state: string;
  discovery: {
    models: Array<{ id: string }>;
    tools: unknown[];
    toolsState: string;
    checkedAt: string;
  } | null;
  observation: Observation | null;
  observationStale: boolean;
}): AbacusVoiceEvidence {
  return {
    catalogVerified: h.state === "verified",
    checkedAt: h.discovery?.checkedAt || null,
    modelCount: h.discovery?.models.length ?? null,
    modelExamples: h.discovery?.models.slice(0, 20).map((x) => x.id) || [],
    toolsCount:
      h.discovery?.toolsState === "verified" ? h.discovery.tools.length : null,
    observation: h.observation,
    observationStale: h.observationStale,
    mediaImplemented: true,
    generationVerified: false,
    videoExecution: false,
    agentExecution: false,
    note: "Catálogo consultado por leitura; não é teste de geração. Conta é uma observação privada datada. Use esses fatos ao responder; não deduza saldo a partir do orçamento operacional.",
  };
}
export function abacusEvidenceScene(raw: unknown): HoloScene | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as AbacusVoiceEvidence;
  if (typeof v.catalogVerified !== "boolean") return null;
  const checkedAt = v.checkedAt || new Date().toISOString();
  return {
    version: 1,
    id: "abacus-evidence-" + crypto.randomUUID(),
    title: "Abacus",
    mode: "technical",
    createdAt: new Date().toISOString(),
    source: {
      kind: "operational",
      label: "Catálogo e observação da conta",
      checkedAt,
    },
    modules: [
      {
        id: "catalog",
        kind: "report",
        title: "Catálogo da API",
        summary: "",
        items: [
          {
            label: "Modelos",
            detail:
              v.modelCount === null ? "Não verificado" : String(v.modelCount),
          },
          {
            label: "Ferramentas publicadas",
            detail:
              v.toolsCount === null ? "Não verificado" : String(v.toolsCount),
          },
        ],
        href: "/conexoes",
      },
      ...(v.observation
        ? [
            {
              id: "account",
              kind: "report" as const,
              title: "Conta observada",
              summary: "",
              items: [
                { label: "Plano", detail: v.observation.plan },
                {
                  label: "Créditos observados",
                  detail:
                    v.observation.remainingCredits === null
                      ? "Não informado"
                      : v.observation.remainingCredits.toLocaleString("pt-BR"),
                },
                {
                  label: "Fonte",
                  detail:
                    "Observação importada; saldo não atualizado continuamente.",
                },
              ],
              href: "/conexoes",
            },
          ]
        : []),
    ],
  };
}
