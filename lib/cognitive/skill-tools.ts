import { CODEX_SKILLS } from "./codex-skill-catalog";
import { CODEX_AGENT_ROLES } from "./codex-agent-roles";

const n8nSkills = new Set([
  "error-handling-patterns", "code-review-excellence", "auth-implementation-patterns",
  "debugging-strategies", "nodejs-backend-patterns", "modern-javascript-patterns",
  "stride-analysis-patterns", "attack-tree-construction", "security-requirement-extraction",
  "threat-mitigation-mapping",
]);
const requirements: Record<string, string> = {
  "git-advanced-workflows": "Executor Git no repositório e aprovação para alterar histórico.",
  "sql-optimization-patterns": "Conexão SQL de leitura e planos EXPLAIN; o catálogo n8n não fornece esses dados.",
  "e2e-testing-patterns": "Runner Playwright/Cypress e navegador no ambiente de teste.",
  "monorepo-management": "Arquivos do repositório; runner para modificar e validar pacotes.",
  "nx-workspace-patterns": "Repositório Nx e runner Nx com resultados verificáveis.",
  "turborepo-caching": "Configuração Turborepo e runner para medir builds/cache.",
  "bazel-build-optimization": "Workspace Bazel e runner para executar e medir builds.",
  "typescript-advanced-types": "Código TypeScript e runner tsc para comprovar compilação.",
  "javascript-testing-patterns": "Código e runner Jest/Vitest para comprovar testes.",
  "sast-configuration": "Scanner SAST configurado e resultados reais de execução.",
};
export function skillToolBindings() {
  return CODEX_SKILLS.map(skill => ({
    id: skill.id, group: skill.group, description: skill.description,
    guidanceAvailable: true, independentExecution: false,
    tools: n8nSkills.has(skill.id) ? ["n8n.workflows.list", "n8n.workflows.details"] : ["github.file", "github.tree"],
    requirement: requirements[skill.id] || "A leitura da estrutura n8n apoia a análise; validar comportamento exige dados e executor específicos.",
  }));
}
export function agentToolBindings() {
  return CODEX_AGENT_ROLES.map(role => ({
    id: role.id, purpose: role.purpose, guidanceAvailable: true, independentExecution: false,
    tools: role.id === "threat-modeling-expert" ? ["n8n.workflows.list", "n8n.workflows.details", "github.file"] : ["github.file", "github.tree"],
  }));
}
export function skillInventoryIntent(message: string) {
  const n = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const subject = /\b(skills?|habilidades)\b/.test(n) || /\b(agentes|agents?)\b/.test(n) && /\b(codex|especialistas|perfis|engenharia)\b/.test(n);
  return subject &&
    /\b(quais|liste|listar|mostre|disponiveis|instalad[oa]s?|conectad[oa]s?|inventario|catalogo|verifique|audite|auditoria)\b/.test(n);
}
