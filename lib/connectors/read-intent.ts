const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function isReadFollowup(message: string) {
  const n = normalized(message).trim();
  return (
    !/\b(apague|exclua|delete|publique|altere|edite|crie|execute)\b/.test(n) &&
    (/^(?:e\b|quanto a\b)/.test(n) ||
      /\b(ele|dele|dela|isso|nesse projeto|neste projeto|la)\b/.test(n))
  );
}
export function selfDiagnosticIntent(message: string) {
  return /\b(o que|quais).*(falta|melhorar).*(voce|jarvis|jk)\b|\bo que.*falta melhorar\b/.test(
    normalized(message),
  );
}
