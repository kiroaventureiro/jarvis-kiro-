"use client";
import { useState } from "react";
type Reply = { ok?: boolean; version?: number; supervised?: boolean; id?: string; state?: string; result?: unknown; error?: string };
type Runtime = { sendMessage: (id: string, message: unknown, callback: (reply: Reply) => void) => void; lastError?: { message?: string } };
function send(id: string, message: unknown): Promise<Reply> {
  const runtime = (window as unknown as { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (!/^[a-p]{32}$/.test(id) || !runtime?.sendMessage) return Promise.reject(Error("Use Chrome ou Edge com a extensão Jarvis instalada e informe seu ID."));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("A extensão não respondeu. Confira o ID e se ela está ativada.")), 8000);
    try { runtime.sendMessage(id, message, reply => {
      clearTimeout(timer);
      if (runtime.lastError || !reply?.ok) reject(Error(reply?.error === "ORIGIN_DENIED"
        ? "A extensão recusou a origem desta página. Recarregue o painel no endereço estável da prévia e tente identificar novamente; isso não indica revogação da extensão."
        : reply?.error || "Não consegui comunicar com a extensão."));
      else resolve(reply);
    }); } catch { clearTimeout(timer); reject(Error("Conexão com a extensão indisponível.")); }
  });
}
export default function BrowserConnection() {
  const [extensionId, setExtensionId] = useState("");
  const [connected, setConnected] = useState(false), [busy, setBusy] = useState(false);
  const [op, setOp] = useState("list"), [tabId, setTabId] = useState(""), [url, setUrl] = useState(""), [label, setLabel] = useState(""), [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null), [result, setResult] = useState<unknown>(null), [message, setMessage] = useState("");
  async function run(fn: () => Promise<void>) { setBusy(true); setMessage(""); try { await fn(); } catch (e) { setMessage(e instanceof Error ? e.message : "Pedido não confirmado."); } finally { setBusy(false); } }
  async function connect() { await run(async () => {
    const reply = await send(extensionId, { type: "hello" });
    if (reply.version !== 1 || reply.supervised !== true) throw Error("Extensão incompatível.");
    setConnected(true); setMessage("Extensão identificada. Nenhuma aba ou página foi consultada.");
  }); }
  async function propose() { await run(async () => {
    const action: Record<string, unknown> = { op };
    if (["focus", "navigate", "read", "fill"].includes(op)) { if (!/^\d{1,12}$/.test(tabId)) throw Error("Informe o ID de uma aba retornado pela listagem."); action.tabId = Number(tabId); }
    if (["open", "navigate"].includes(op)) action.url = url;
    if (op === "fill") { action.label = label; action.text = text; }
    const reply = await send(extensionId, { type: "propose", action });
    if (typeof reply.id !== "string") throw Error("Referência inválida.");
    setPending(reply.id); setResult(null);
    setMessage("Pedido preparado por cinco minutos. Abra o ícone da extensão e revise a ação. Para ler ou preencher, primeiro ative a aba de destino e abra a extensão nela.");
  }); }
  async function status() { await run(async () => {
    const reply = await send(extensionId, { type: "result", id: pending });
    setResult(reply.result); setMessage("Estado do pedido: " + reply.state + ". Abertura/navegação confirma o envio ao navegador, não o carregamento do destino.");
    if (["completed", "failed", "denied"].includes(reply.state || "")) setPending(null);
  }); }
  return <section className="glass notice" aria-label="Navegador supervisionado">
    <h2>Conectar Chrome ou Edge neste computador</h2>
    <p>A extensão precisa ser instalada e autorizada por você. Não há acesso automático ao navegador do Codex. Esta versão atende somente a prévia de auditoria.</p>
    <p><a href="/api/director/browser-extension">Baixar extensão para revisão e instalação</a></p>
    <ol><li>Extraia o arquivo em uma pasta deste computador.</li><li>Abra a página de extensões do navegador, habilite o modo de desenvolvedor e use “Carregar sem compactação”.</li><li>Selecione a pasta extraída, fixe o ícone e copie o ID exibido pela extensão.</li></ol>
    <label htmlFor="browser-extension-id">ID da extensão Jarvis</label>
    <input id="browser-extension-id" value={extensionId} onChange={e => { setExtensionId(e.target.value.trim()); setConnected(false); setPending(null); setResult(null); }} maxLength={32} autoComplete="off" disabled={busy || !!pending} />
    <button disabled={busy || !!pending} onClick={() => void connect()}>Identificar extensão</button>
    <p>{connected ? "Extensão identificada neste navegador." : "Extensão ainda não identificada."}</p>
    <label htmlFor="browser-op">Ação solicitada</label>
    <select id="browser-op" value={op} onChange={e => setOp(e.target.value)} disabled={busy || !!pending}>
      <option value="list">Consultar abas abertas</option><option value="open">Abrir página HTTPS</option><option value="focus">Ativar aba</option><option value="navigate">Navegar em uma aba</option><option value="read">Ler texto da aba ativa</option><option value="fill">Preencher um campo</option>
    </select>
    {["focus", "navigate", "read", "fill"].includes(op) ? <><label htmlFor="browser-tab">ID da aba</label><input id="browser-tab" inputMode="numeric" value={tabId} onChange={e => setTabId(e.target.value)} disabled={busy || !!pending} /></> : null}
    {["open", "navigate"].includes(op) ? <><label htmlFor="browser-url">Endereço HTTPS</label><input id="browser-url" type="url" value={url} onChange={e => setUrl(e.target.value)} disabled={busy || !!pending} /></> : null}
    {op === "fill" ? <><label htmlFor="browser-label">Rótulo exato do campo</label><input id="browser-label" value={label} onChange={e => setLabel(e.target.value)} maxLength={100} disabled={busy || !!pending} /><label htmlFor="browser-text">Texto a preencher</label><textarea id="browser-text" value={text} onChange={e => setText(e.target.value)} maxLength={2000} disabled={busy || !!pending} /><p>Sem envio automático. Senhas, códigos de acesso e campos de pagamento são recusados. O site pode processar o texto enquanto ele é preenchido.</p></> : null}
    <button disabled={busy || !connected || !!pending} onClick={() => void propose()}>Preparar ação para revisão na extensão</button>
    {pending ? <button disabled={busy} onClick={() => void status()}>Consultar resultado da ação</button> : null}
    {message ? <p role="status">{message}</p> : null}
    {result ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 420, overflowY: "auto" }}>{JSON.stringify(result, null, 2)}</pre> : null}
    <p>Resultados ficam nesta tela, sem envio automático ao servidor ou à IA. A listagem omite abas anônimas e parâmetros das URLs. A leitura é limitada a 8 mil caracteres e deve ser tratada como conteúdo externo. Este painel não transfere cookies, senhas ou sessões e não oferece execução arbitrária de scripts.</p>
  </section>;
}
