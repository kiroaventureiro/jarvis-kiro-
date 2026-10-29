import { planCodexDelegation, type CodexTaskKind } from "./delegation-plan";

/**
 * Conservative conversational preparation only. A worker must be separately
 * connected and approved before an actual Codex session can start.
 */
export function answerCodexPlanning(message: string) {
  const n = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\bcodex\b/.test(n)) return null;
  if (!/\b(peca|pede|mande|enviar|envie|delegue|delegar|prepare|preparar|solicite|solicitar)\b/.test(n))
    return null;
  if (!/\b(revisar|revise|analisar|analise|testar|teste|implementar|implemente|corrigir|corrija|desenvolver|desenvolva)\b/.test(n))
    return null;
  const kind: CodexTaskKind = /\b(testar|teste)\b/.test(n) ? "test"
    : /\b(revisar|revise|analisar|analise)\b/.test(n) ? "review" : "implement";
  // This default is specifically the Jarvis' own development project.
  // Other repositories must be explicitly authorized through the API.
  const plan = planCodexDelegation({
    kind,
    repository: "kiroaventureiro/jarvis-kiro-",
    branch: "feature/diretor-tecnico-agent",
    task: message.slice(0, 1500),
  });
  return {
    text: "Preparei um pedido de " + (kind === "test" ? "testes" : kind === "review" ? "revisão" : "desenvolvimento") +
      " para o Codex na branch experimental do Jarvis. Ainda não o enviei: não há executor Codex autenticado conectado ao JK. Nenhuma alteração ou teste foi executado.",
    model: "jk-codex-planner",
    provider: "local_operational" as const,
    usage: null,
    codexPlan: plan,
  };
}
