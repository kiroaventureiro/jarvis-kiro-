export type GitHubWriteIntent =
  | { kind: "create_file"; path: string; content: string }
  | { kind: "create_folder"; path: string; content: string }
  | null;

export function parseGitHubWriteIntent(message: string): GitHubWriteIntent {
  const folded = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\b(crie|cria|criar|adicione|adiciona|adicionar|escreva|escrever|monte|montar)\b/.test(folded)) return null;
  if (!/\b(github|repositorio|projeto|jarvis\s+kiro)\b/.test(folded)) return null;

  const folder = /\b(?:pasta|diret[oó]rio)\s+(?:chamad[ao]\s+|com\s+nome\s+)?["']?([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*)["']?/i.exec(message);
  if (folder) {
    const name = folder[1].replace(/\/+$/, "");
    if (!name || name === "." || name === ".." || name.split("/").some(p => p === "." || p === "..")) return null;
    return { kind: "create_folder", path: name + "/.gitkeep", content: "" };
  }

  const file = /\barquivo\s+([a-zA-Z0-9_.\/-]{3,160})\s+(?:com\s+(?:o\s+)?conte[uú]do|contendo)\s*[:：]\s*([\s\S]+)/i.exec(message);
  if (!file || file[2].length > 24000) return null;
  return { kind: "create_file", path: file[1], content: file[2] };
}

export function isConversationalGitHubApproval(message: string) {
  const normalized=message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return /^(?:jarvis[,!.]?\s*)?aprovar\s+[a-f0-9]{8}[.!\s]*$/.test(normalized) ||
    /^(?:(?:sim|eu)[,!.]?\s*)?(?:aprovo|autorizo|confirmo|pode executar|pode criar|pode fazer|pode prosseguir|esta aprovado|aprovado)[.! ]*$/.test(normalized);
}
