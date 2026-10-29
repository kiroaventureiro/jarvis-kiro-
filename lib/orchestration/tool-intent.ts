/** Small, deterministic tool-intent planner. Never executes third-party code or paid calls.
 * Architectural reference: microsoft/JARVIS (planning/tool routing), not copied code.
 */
export type ToolDomain = "account" | "voice" | "image" | "video" | "avatar" | "code" | "general";
export type PlannedTool = { domain: ToolDomain; mode: "read" | "generate" | "modify" | "none"; approvalRequired: boolean; executableNow: boolean; reason: string };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function planToolIntent(input: string): PlannedTool {
  const n = normalize(input).slice(0,3000);
  const request = /\b(crie|criar|gere|gerar|faca|fazer|produza|produzir|edite|editar|altere|alterar|publique|publicar|apague|apagar)\b/.test(n);
  const domain: ToolDomain =
    /\b(abacus|avacus|abagus)\b/.test(n) && /\b(projetos|deploys|deployments|conta)\b/.test(n) ? "account" :
    /\b(voicestudio|voice studio|transcricao|ditado|voz|audio)\b/.test(n) ? "voice" :
    /\b(video|videos|filmagem|animacao)\b/.test(n) ? "video" :
    /\b(imagem|imagens|foto|fotos|ilustracao)\b/.test(n) ? "image" :
    /\b(avatar|personagem 3d|humano digital)\b/.test(n) ? "avatar" :
    /\b(codigo|programa|software|site|aplicativo)\b/.test(n) ? "code" : "general";
  const mode: PlannedTool["mode"] = /\b(apague|apagar|edite|editar|altere|alterar|publique|publicar)\b/.test(n) ? "modify" :
    request ? "generate" : domain === "general" ? "none" : "read";
  const executableNow = domain === "account" && mode === "read";
  const reason = executableNow ? "A API Developer Platform possui consulta autenticada de leitura; execução ainda depende da rota apropriada." :
    domain === "general" ? "Nenhuma ferramenta especializada identificada." :
    "Ferramenta especializada requer capacidade verificada e autorização específica antes da execução.";
  return {domain,mode,approvalRequired:mode==="modify"||mode==="generate",executableNow,reason};
}

/** Route only a read that has an existing, verified executor. Other domains
 * remain advice-only until explicitly wired and approved. */
export function shouldRunPlatformRead(input: string): boolean {
  const p = planToolIntent(input);
  return p.domain === "account" && p.mode === "read";
}
