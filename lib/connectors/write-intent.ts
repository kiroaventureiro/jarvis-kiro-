export type GitHubWriteIntent = { kind: "create_file"; path: string; content: string } | null;
export function parseGitHubWriteIntent(message: string): GitHubWriteIntent {
  const folded = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\b(crie|cria|criar|adicione|adiciona|adicionar|escreva|escrever)\b/.test(folded)) return null;
  if (!/\b(github|repositorio|projeto)\b/.test(folded)) return null;
  const match = /\barquivo\s+([a-zA-Z0-9_.\/-]{3,160})\s+(?:com\s+(?:o\s+)?conte[uú]do|contendo)\s*[:：]\s*([\s\S]+)/i.exec(message);
  if (!match || match[2].length > 24000) return null;
  return {kind:"create_file",path:match[1],content:match[2]};
}
