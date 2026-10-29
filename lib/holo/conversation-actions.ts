export type ExportFormat = "pdf" | "png" | "json" | "webm";
export function conversationAction(
  text: string,
): { kind: "export"; format: ExportFormat } | { kind: "external" } | null {
  const n = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (
    /\b(envi[ae]|compartilhe|salve no|salvar no)\b/.test(n) &&
    /resultado|relatorio|analise|projeto|pdf/.test(n)
  )
    return { kind: "external" };
  if (
    !/\b(prepare|preparar|gere|gerar|crie|criar|exporte|exportar|quero|faca)\b/.test(
      n,
    )
  )
    return null;
  const format = /\bpdf\b/.test(n)
    ? "pdf"
    : /\bpng\b/.test(n)
      ? "png"
      : /\bjson\b/.test(n)
        ? "json"
        : /\bwebm\b|video (?:dessa|desta|da) (?:analise|demonstracao)/.test(n)
          ? "webm"
          : null;
  return format ? { kind: "export", format } : null;
}
