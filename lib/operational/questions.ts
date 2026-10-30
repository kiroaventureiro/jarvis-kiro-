import type { OperationalSnapshot, ServiceStatus } from "./state";
export type OperationalQuestion =
  | "abacus"
  | "memory"
  | "projects"
  | "pending"
  | "overview";
export function operationalQuestion(
  message: string,
): OperationalQuestion | null {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    /^(?:(?:jarvis|navi)[, ]*)?(?:conecte|ative|execute|publique|salve|apague|crie)\b/.test(
      n,
    )
  )
    return null;
  const query =
    /\b(quais|qual|que|como|voce|sua|seu|esta|estao|funciona|funcionam|conhece|configurados|conectados|capacidades|tenho|tem|posso|acesso|autorizado|disponivel)\b/.test(
      n,
    );
  if (!query) return null;
  if (
    /\b(abacus|routellm)\b/.test(n) &&
    /conect|configur|funcion|operacion|status|autoriz|disponiv/.test(n)
  )
    return "abacus";
  if (
    /\b(supabase|memoria)\b/.test(n) &&
    /conect|configur|funcion|operacion|status|autoriz|disponiv/.test(n)
  )
    return "memory";
  if (
    /(?:quais|que) projetos|projetos.{0,40}conhece|conhece.{0,40}projetos/.test(
      n,
    )
  )
    return "projects";
  // Named platform questions must use dated operational evidence, not the catalog.
  // A known service is not necessarily connected to an authorized account.
  if (
    /\b(github|vercel)\b/.test(n) &&
    /\b(conectad[oa]s?|configurad[oa]s?|autorizad[oa]s?|disponiv(?:el|eis)|funcionando|acesso|status|operacional)\b/.test(n)
  )
    return "overview";
  if (
    /(?:aplicativos|plataformas|integracoes|sistemas).*(?:ainda|precisam|pendentes)|(?:ainda|pendentes).*(?:conectar|aplicativos|integracoes)/.test(
      n,
    )
  )
    return "pending";
  if (
    /(?:sistemas?|integracoes|integracao|conexoes|conexao|capacidades|servicos?|aplicativos|plataformas|conectores).*(?:configur|ativ|conect|operacion|disponiv|possui|tem|acesso|conhece)|(?:quais|suas|possui|tem).*(?:integracoes|integracao|capacidades|conexoes|conexao|aplicativos|plataformas|conectores)/.test(
      n,
    )
  )
    return "overview";
  return null;
}
function describe(s: ServiceStatus) {
  if (!s.configured) return s.name + ": não configurado neste ambiente.";
  if (!s.configurationValid)
    return (
      s.name +
      ": há configuração, mas ela está incompleta ou inválida. " +
      s.note
    );
  if (s.state === "temporarily_unavailable")
    return (
      s.name +
      ": temporariamente indisponível para a capacidade verificada. " +
      (s.budgetAvailable === false
        ? "O limite local foi atingido; isso não prova desconexão."
        : "A última verificação não foi concluída com sucesso; não significa que nunca esteve conectado.")
    );
  if (!s.verified)
    return (
      s.name +
      ": credenciais configuradas; falta uma validação recente. Não vou afirmar que está desconectado nem funcionando sem verificar."
    );
  let text = s.name + ": " + s.label.toLowerCase() + ". ";
  if (s.id === "abacus")
    text += s.checks.includes("conversation")
      ? "Uma resposta de conversa foi concluída com sucesso. "
      : "O catálogo autenticado da API respondeu; essa consulta não executa um modelo. ";
  if (s.id === "supabase-memory")
    text += s.checks.includes("encrypted_read")
      ? "Leitura e descriptografia de um registro existente foram verificadas, sem expor seu conteúdo. "
      : "A tabela respondeu, mas a leitura e a descriptografia de um registro não estão confirmadas por esta evidência. ";
  if (s.id === "abacus" && !s.authorized)
    text += "O uso de modelos permanece bloqueado pela política de custos. ";
  if (s.id === "supabase-memory")
    text +=
      (s.checks.includes("encrypted_write")
        ? "Gravação autorizada foi confirmada nesta instância. "
        : "Gravação não foi testada nesta consulta. ") +
      "Guardar, restaurar ou apagar conversas continua sendo uma ação manual autorizada.";
  return text;
}
export function operationalAnswer(
  kind: OperationalQuestion,
  snapshot: OperationalSnapshot,
) {
  if (kind === "projects")
    return (
      "Conheço " +
      snapshot.projects.length +
      " projetos do índice da KIRO: " +
      snapshot.projects.map((p) => p.name).join("; ") +
      ". Conhecer esse catálogo não significa ter contas ou aplicativos desses projetos conectados."
    );
  if (kind === "pending")
    return (
      "O catálogo mantém " +
      snapshot.catalog.total +
      " plataformas. " +
      snapshot.catalog.notConfigured +
      " ainda não têm configuração reconhecida neste ambiente e " +
      snapshot.catalog.needsValidation +
      " têm configuração, mas precisam de validação atual. Exemplos sem configuração: " +
      (snapshot.catalog.examples.join(", ") || "nenhum") +
      ". Serviços já configurados ou validados são informados separadamente; estar no catálogo não concede acesso."
    );
  if (kind === "abacus" || kind === "memory") {
    const s = snapshot.integrations.find(
      (x) => x.id === (kind === "abacus" ? "abacus" : "supabase-memory"),
    );
    return s
      ? describe(s)
      : "Não há informação operacional para esse serviço neste ambiente.";
  }
  const configured = snapshot.integrations.filter((x) => x.configured);
  return configured.length
    ? "Neste ambiente, os sistemas com configuração são: " +
        configured.map(describe).join(" ") +
        " As demais plataformas continuam no catálogo, sem conexão comprovada."
    : "Nenhum dos serviços acompanhados pelo registro tem configuração completa neste ambiente. Isso não descreve outros ambientes nem apaga os projetos KIRO cadastrados.";
}
