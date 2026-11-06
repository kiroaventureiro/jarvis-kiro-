import type { StateStore, VaultState } from "./types";
import { WORKSPACE_SERVICES, type WorkspaceState } from "./workspace";

const names = { google: "Google", microsoft: "Microsoft", github: "GitHub", vercel: "Vercel", supabase: "Supabase", browser: "Navegador" };
type Target = keyof typeof names;
/** Status questions inspect saved grants, never read mail, execute actions or change scopes. */
export function authorizationStatusIntent(message: string): Target[] | null {
  const n = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(?:conecte|autorize|revogue|desconecte|remova|publique|execute|envie|apague|edite)\b/.test(n)) return null;
  if (!/acess|autoriz|permiss|conect|conex|integrac/.test(n)) return null;
  const targets: Target[] = [];
  if (/\b(?:google|gmail|drive|youtube)\b/.test(n)) targets.push("google");
  if (/\b(?:microsoft|outlook|onedrive)\b/.test(n)) targets.push("microsoft");
  if (/\b(?:github|git hub)\b/.test(n)) targets.push("github");
  if (/\bvercel\b/.test(n)) targets.push("vercel");
  if (/\bsupabase\b/.test(n)) targets.push("supabase");
  if (/\b(?:navegador|chrome|edge|extensao)\b/.test(n)) targets.push("browser");
  if (targets.length) return targets;
  if (/\b(?:n8n|abacus|gemini|openai|codex)\b/.test(n)) return null;
  return /(?:quais|minhas|suas|todas|meus|seus).*(?:autoriz|permiss|conex|acess)|(?:autoriz|permiss|conex).*(?:encerr|expir|perd|sum|salv)/.test(n)
    ? ["google", "microsoft", "github", "vercel", "supabase", "browser"] : null;
}

/** Non-secret projection shared by conversation and operational context. */
export function workspaceAuthorization(state: VaultState & WorkspaceState, provider: "google" | "microsoft") {
  const account = state.workspaceAccounts?.[provider];
  const services = WORKSPACE_SERVICES.filter(s => s.provider === provider && account?.services.includes(s.id));
  return { provider, saved: !!account, services: services.map(s => ({ id: s.id, name: s.name, verifiedAt: account?.verifiedAt[s.id] || null })) };
}

export async function answerAuthorizationStatus(message: string, store: StateStore) {
  const targets = authorizationStatusIntent(message);
  if (!targets) return null;
  const browser = "Navegador: o conector local supervisionado está implementado em /integracoes/navegador, somente no endereço estável da prévia de auditoria. A instalação e a comunicação com a extensão são verificadas nesse painel, não pelo servidor. Cada ação exige sua aprovação local. O controle da extensão por voz ainda não está ligado; isso não significa autorização revogada.";
  let state: (VaultState & WorkspaceState) | null = null;
  if (targets.some(t => t !== "browser")) {
    try { if (store.configured()) state = await store.read(); } catch { /* Unknown is not disconnected. */ }
  }
  const lines = targets.map(target => {
    if (target === "browser") return browser;
    if (!state) return names[target] + ": não consegui consultar o cofre atual. Não posso afirmar que a autorização foi encerrada.";
    if (target === "google" || target === "microsoft") {
      const view = workspaceAuthorization(state, target);
      if (!view.saved) return names[target] + ": não encontrei autorização salva neste ambiente. Isso não descreve outras versões do Jarvis.";
      return names[target] + ": autorização salva para " + (view.services.map(s => s.name).join(", ") || "nenhum serviço reconhecido") +
        ". Posso consultar os metadados dos serviços autorizados quando você pedir. Não leio corpos de e-mail nem altero arquivos por esse conector. " +
        "Esta consulta confirmou o registro da autorização, sem testar os serviços agora. Para testar, peça por exemplo: " + (target === "google" ? "liste os arquivos do Drive." : "liste os arquivos do OneDrive.");
    }
    const connection = state.connections[target];
    if (!connection || connection.status === "disconnected") return names[target] + ": não há conexão ativa registrada neste ambiente.";
    const read = connection.status === "connected" && connection.grants.includes("read") && connection.resources.length > 0;
    return names[target] + ": credencial salva; " + (read ? "leitura autorizada em " + connection.resources.length + " recursos selecionados." : "o escopo de leitura precisa de verificação.") +
      " Permissões locais: " + (connection.grants.join(", ") || "nenhuma") + ". " +
      (connection.lastError ? "A última verificação falhou; isso não prova revogação. " : "Não fiz uma consulta ao provedor agora. ") +
      "Alterações continuam sujeitas ao recurso permitido e a um plano aprovado; esta resposta não concede nem amplia permissões.";
  });
  return { text: lines.join("\n\n"), model: "jk-authorization-status", provider: "local_operational" as const, usage: null };
}
