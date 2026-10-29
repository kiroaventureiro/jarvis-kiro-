/** Task-specific guidance adapted from wshobson/agents (MIT), not a subagent runtime.
 * Source and license: docs/WSHOBSON-AGENTS.md. No tools, models or grants are added.
 */
export const SPECIALIST_SOURCE = {
  repository: "wshobson/agents",
  revision: "0874a27b17a22e2b7c2e2bcd725768e0803cad06",
} as const;
/** A neural session starts before its question is known; this is conditional
 * guidance, not a claim that the deterministic selector ran for each turn. */
export function voiceSpecialistGuidance() {
  return "ORIENTAÇÃO ESPECIALIZADA DE ENGENHARIA: somente em pedidos sobre código, APIs ou software, adapte a análise ao objetivo. Depuração: separe observação, hipótese e reprodução. Revisão: priorize defeitos verificáveis e consequências. Testes: cubra comportamentos e falhas, distinguindo fixtures de integração real. JavaScript/TypeScript: verifique contratos, concorrência e limpeza de recursos. Segurança: confira entradas e permissões, sem expor segredos. Não anuncie especialistas independentes, scanners ou testes que não executou. Isso não adiciona ferramentas, permissões ou chamadas a modelos; preserve a narração natural e o HUD complementar.";
}
const profiles = [
  {
    id: "security",
    match:
      /\b(seguranca|vulnerabilidade|vulnerabilidades|owasp|xss|sql injection|autenticacao|credenciais)\b/,
    guidance:
      "Na análise de segurança, identifique entradas não confiáveis, autenticação e limites de permissão. Relacione cada risco a um caminho verificável e a uma mitigação. Diferencie suspeita, achado confirmado e scanner realmente executado; não exponha segredos.",
  },
  {
    id: "debugging",
    match:
      /\b(debug|depure|depurar|bug|erro|erros|falha|falhas|travando|nao funciona|lento|lentidao)\b/,
    guidance:
      "Na depuração, reúna comportamento esperado, observado e mudanças recentes disponíveis. Separe hipóteses de evidências e proponha a menor reprodução ou medição que diferencie as causas. Valide a correção no cenário original quando houver ferramentas autorizadas; não afirme ter reproduzido sem teste.",
  },
  {
    id: "review",
    match: /\b(revise|revisao|review|pull request|audite|auditoria)\b/,
    guidance:
      "Na revisão, priorize defeitos de comportamento, tratamento de falhas e regressões. Para cada achado, informe gatilho, consequência e evidência no código consultado. Separe bloqueios de sugestões de estilo; não invente arquivos, linhas ou aprovação de mudanças.",
  },
  {
    id: "testing",
    match: /\b(testes?|testing|vitest|jest|playwright|cobertura|regressao)\b/,
    guidance:
      "Nos testes, escolha comportamentos observáveis, caminhos de falha e limites relevantes ao pedido. Isole APIs externas com fixtures quando adequado e distinga resultados simulados de integração real. Descreva comandos e resultados efetivamente executados, sem tratar cobertura como prova de correção.",
  },
  {
    id: "typescript",
    match: /\b(typescript|javascript|node\.js|react|next\.js|tipagem|tipos)\b/,
    guidance:
      "Em JavaScript e TypeScript, verifique contratos de entrada, nulidade, concorrência assíncrona e limpeza de recursos. Preserve as convenções e dependências existentes; evite usar tipos ou coerções para esconder falhas de validação em runtime.",
  },
] as const;
export function selectSpecialistGuidance(message: string) {
  const n = message
    .slice(0, 3000)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const coding =
    /\b(codigo|typescript|javascript|react|next\.js|node\.js|software|aplicativo|api|repositorio|github|commit|pull request|build|compilacao|runtime|stack trace|vitest|jest|playwright|sql|banco de dados)\b/.test(
      n,
    );
  if (!coding) return [];
  return profiles
    .filter((p) => p.match.test(n))
    .slice(0, 2)
    .map((p) => ({ id: p.id, guidance: p.guidance }));
}
export function specialistGuidance(message: string) {
  const selected = selectSpecialistGuidance(message);
  return selected.length
    ? "ORIENTAÇÃO ESPECIALIZADA DE ENGENHARIA: " +
        selected.map((p) => p.guidance).join(" ") +
        " São orientações desta resposta, não agentes independentes em execução; mantêm-se as ferramentas, permissões e orçamento existentes."
    : "";
}
