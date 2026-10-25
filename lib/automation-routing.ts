/**
 * Regras declarativas iniciais; não executam ferramentas nem transmitem dados.
 * A camada de autorização deve validar identidade, escopo e orçamento antes de executar.
 */
export type AutomationRequest = {
  operation: "answer" | "read" | "workflow" | "write" | "publish" | "delete" | "payment";
  steps: number;
  repeats: boolean;
  dataIsFresh: boolean;
};
export type RouteDecision = { route: "local" | "direct_api" | "n8n" | "approval"; persist: "none" | "minimal" };
export function decideAutomationRoute(req: AutomationRequest): RouteDecision {
  if (["write","publish","delete","payment"].includes(req.operation)) return {route:"approval",persist:"minimal"};
  if (req.operation==="answer" && req.dataIsFresh) return {route:"local",persist:"none"};
  if (req.repeats || req.steps>1 || req.operation==="workflow") return {route:"n8n",persist:"minimal"};
  return {route:"direct_api",persist:"none"};
}
