/** User-initiated navigation only. Never submits prompts or starts a remote task. */
export const JARVIS_ORIGIN = "https://github.com/kiroaventureiro/jarvis-kiro-.git";
export const APP_SHORTCUTS = [
  {name:"Codex",url:"https://chatgpt.com/codex"},
  {name:"ChatGPT",url:"https://chatgpt.com/"},
  {name:"Google",url:"https://www.google.com/"},
  {name:"Microsoft 365",url:"https://www.microsoft365.com/"},
  {name:"GitHub Jarvis",url:"https://github.com/kiroaventureiro/jarvis-kiro-/tree/feature/diretor-tecnico-agent"},
  {name:"Supabase",url:"https://supabase.com/dashboard"},
  {name:"Vercel",url:"https://vercel.com/umiversokiro/jarvis-kiro"},
] as const;

/** Browser navigation is offered as a link, never automatic remote browser control. */
export function browserActionIntent(message:string): {name:string;url:string}|null {
  const text=message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if(!/\b(abra|abrir|acesse|acessar|pesquise|pesquisar|busque|buscar|procure)\b/.test(text))return null;
  if(/\b(pesquise|pesquisar|busque|buscar|procure)\b/.test(text) && /\b(google|navegador|web|internet|bing)\b/.test(text)) {
    // Apply the same credential refusal before putting any request in a search URL.
    prepareAppHandoff(message,"chatgpt");
    const query=message.replace(/^.*?\b(?:pesquise|pesquisar|busque|buscar|procure)\s*/i,"")
      .replace(/^(?:no|na|pelo|pela)\s+(?:google|navegador|web|internet|bing)\s*(?:sobre\s+|por\s+)?/i,"").trim();
    if(!query)return {name:"Google",url:"https://www.google.com/"};
    const engine=/\bbing\b/.test(text)?"https://www.bing.com/search?q=":"https://www.google.com/search?q=";
    return {name:"Pesquisa no navegador",url:engine+encodeURIComponent(Array.from(query.toWellFormed()).slice(0,400).join(""))};
  }
  if(/\bcodex\b|\bchatgpt\b|\bnavi\b/.test(text))return null;
  if(/\b(google|navegador|chrome|edge)\b/.test(text))return {name:"Google",url:"https://www.google.com/"};
  if(/\b(microsoft|office|outlook)\b/.test(text))return {name:"Microsoft 365",url:"https://www.microsoft365.com/"};
  if(/\bgithub\b/.test(text))return APP_SHORTCUTS[4];
  if(/\bsupabase\b/.test(text))return APP_SHORTCUTS[5];
  if(/\bvercel\b/.test(text))return APP_SHORTCUTS[6];
  return null;
}
export function appHandoffIntent(message: string): "codex" | "chatgpt" | null {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!/\b(peca|pedir|pergunte|perguntar|solicite|prepare|abra|abrir|envie|mandar|mande|encaminhe|revisar|revise|analise|implemente|teste|ajude)\b/.test(text)) return null;
  if (/\bcodex\b/.test(text)) return "codex";
  return /\b(chatgpt|navi)\b/.test(text) ? "chatgpt" : null;
}
export function prepareAppHandoff(message: string, destination: "codex" | "chatgpt", origin = JARVIS_ORIGIN) {
  if (origin !== JARVIS_ORIGIN) throw Error("INVALID_ORIGIN");
  // Refuse suspect content rather than transfer partially redacted credentials.
  if (/(?:sk-|gh[pousr]_|github_pat_)[a-zA-Z0-9_-]{8,}|Bearer\s+\S+|-----BEGIN [\w ]*PRIVATE KEY-----|eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:password|senha|secret|token|api[_-]?key|cookie|authorization)[\"\']?\s*[=:]\s*\S+/i.test(message))
    throw Error("SENSITIVE_REQUEST");
  const clean = message.toWellFormed().replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!clean) throw Error("EMPTY_REQUEST");
  const truncated = Array.from(clean).length > 400;
  const objective = Array.from(clean).slice(0, 400).join("");
  const prompt = `Pedido preparado pelo Jarvis\nObjetivo: ${objective}${truncated ? " [pedido abreviado; confirme o escopo]" : ""}\nContexto de referência: https://github.com/kiroaventureiro/jarvis-kiro-\nBranch autorizada: feature/diretor-tecnico-agent. Se o objetivo citar outro projeto, confirme o repositório antes de alterar.\nAceite: atender ao objetivo, executar verificações cabíveis e apresentar evidências e limites.\nLimites: não alterar main, não publicar, não gerar custos adicionais nem solicitar credenciais.\nO usuário revisará e enviará este pedido. Não há execução iniciada pelo Jarvis.`;
  const codexUrl = "codex://new?prompt=" + encodeURIComponent(prompt) + "&originUrl=" + encodeURIComponent(origin);
  return {destination, prompt, codexUrl, truncated, codexWebUrl:"https://chatgpt.com/codex", chatgptUrl:"https://chatgpt.com/"};
}
export type AppHandoff = ReturnType<typeof prepareAppHandoff>;
