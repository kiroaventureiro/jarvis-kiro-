export type GitHubWriteIntent =
  | { kind: "create_file"; path: string; content: string }
  | { kind: "create_folder"; path: string; content: string }
  | null;

export function parseGitHubWriteIntent(message: string, context = ""): GitHubWriteIntent {
  const folded = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\b(crie|cria|criar|adicione|adiciona|adicionar|escreva|escrever|monte|montar)\b/.test(folded)) return null;
  if (!/\b(github|git hub|kit hub|repositorios?|projeto|jarvis\s+kiro|javaski)\b/.test((message+" "+context).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase())) return null;

  // Preserve multiword names spoken in Portuguese, e.g. "JavaScript Texts".
  // Stop at repository/project context, not at the first whitespace.
  const folder = /\b(?:pasta|diret[oó]rio)\s+(?:chamad[ao]\s+|com\s+(?:o\s+)?nome\s+)?(?:"([^"]+)"|'([^']+)'|(.+?))(?=\s+(?:no|na|do|da|para\s+o|para\s+a)\s+(?:reposit[oó]rio|projeto|github|git\s*hub|jarvis\b)|[.!?;,]|$)/i.exec(message);
  if (folder) {
    const name = (folder[1] || folder[2] || folder[3] || "").trim().replace(/\/+$/, "");
    if (!name || name.length > 180 || name === "." || name === ".." ||
        name.split("/").some(p => !p.trim() || p.trim() === "." || p.trim() === "..") ||
        /[\\\x00-\x1f?#%]/.test(name) ||
        name.startsWith("/")) return null;
    return { kind: "create_folder", path: name + "/.gitkeep", content: "" };
  }

  const file = /\barquivo\s+([a-zA-Z0-9_.\/-]{3,160})\s+(?:com\s+(?:o\s+)?conte[uú]do|contendo)\s*[:：]\s*([\s\S]+)/i.exec(message);
  if (!file || file[2].length > 24000) return null;
  return { kind: "create_file", path: file[1], content: file[2] };
}

export function isConversationalGitHubApproval(message: string) {
  const normalized=message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const code=/^(?:jarvis[,!:.]?\s*)?aprovar\s+[a-f0-9]{8}[.!\s]*$/i.test(normalized);
  const natural=/^(?:jarvis[,!:.]?\s*)?(?:(?:sim|eu)[,!.]?\s*)?(?:aprovo|autorizo|confirmo|pode executar|pode criar|pode fazer|pode prosseguir|esta aprovado|aprovado)[.!\s]*$/i.test(normalized);
  return code||natural;
}
