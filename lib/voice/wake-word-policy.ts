export function normalizeSpeech(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
export function parseWake(
  text: string,
  armed: boolean,
): { accepted: boolean; command: string; activation: boolean } {
  const normalized = normalizeSpeech(text);
  const match = /\bjarvis\b/.exec(normalized);
  if (!match)
    return {
      accepted: armed && !!normalized,
      command: text.trim(),
      activation: false,
    };
  const before = normalized.slice(0, match.index).trim();
  const after = normalized.slice(match.index + 6).trim();
  const greeting = /^(bom dia|boa tarde|boa noite)$/.test(before) ? before : "";
  return {
    accepted: true,
    command: after || (greeting ? greeting : "Jarvis"),
    activation: true,
  };
}
export function localVoiceReply(
  text: string,
): { text: string; navigate?: string } | null {
  const n = normalizeSpeech(text);
  if (n === "jarvis" || n === "ei" || n === "oi")
    return { text: "Estou ouvindo. O que você precisa?" };
  if (["bom dia", "boa tarde", "boa noite"].includes(n))
    return {
      text:
        n.charAt(0).toUpperCase() +
        n.slice(1) +
        "! Estou à disposição. O que vamos fazer hoje?",
    };
  const routes: Record<string, string> = {
    projetos: "/projetos",
    memoria: "/memoria",
    integracoes: "/integracoes",
    configuracoes: "/configuracoes",
    diagnostico: "/diagnostico",
    controle: "/controle",
  };
  const match =
    /^(?:abra|abrir|mostre|mostrar|acesse)(?: os| as| meus| minhas| a| o)? (projetos|memoria|integracoes|configuracoes|diagnostico|controle)$/.exec(
      n,
    );
  return match
    ? { text: "Abrindo " + match[1] + ".", navigate: routes[match[1]] }
    : null;
}
export class CommandDeduplicator {
  private last = "";
  private at = -Infinity;
  accept(text: string, now: number) {
    const n = normalizeSpeech(text);
    if (n === this.last && now - this.at < 3000) return false;
    this.last = n;
    this.at = now;
    return true;
  }
}
