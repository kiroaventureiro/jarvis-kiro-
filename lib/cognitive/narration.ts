/** Presentation text is not a speech script. Remove machine-oriented material without inventing facts. */
export function spokenExplanation(text: string) {
  return text
    .replace(
      /\x60{3}[\s\S]*?\x60{3}/g,
      " O código está disponível no resultado visual. ",
    )
    .replace(
      /\{[^{}]*[":][^{}]*\}/g,
      " Detalhes estruturados estão disponíveis no resultado. ",
    )
    .replace(/https?:\/\/\S+/g, " fonte disponível no resultado ")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, " referência técnica ")
    .replace(/\b[0-9a-f]{20,64}\b/gi, " referência do código ")
    .replace(/\b(?:prj_|dpl_|repo_)[\w-]+\b/g, " recurso autorizado ")
    .replace(/\b\d{4}-\d\d-\d\dT[\d:.]+Z?\b/g, " no horário registrado ")
    .replace(/\b\d{10,}\b/g, " identificador técnico ")
    .replace(/[\x60*_#|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
