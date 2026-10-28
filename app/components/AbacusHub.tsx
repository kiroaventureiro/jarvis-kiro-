"use client";
import { useEffect, useRef, useState } from "react";
import {
  ABACUS_SURFACES,
  type AccountObservation,
  type ModelEntry,
  type ToolEntry,
} from "../../lib/abacus/hub";
import { MEDIA_MODELS, type MediaKind } from "../../lib/abacus/media";
type Hub = {
  state: string;
  discovery: {
    models: ModelEntry[];
    tools: ToolEntry[];
    toolsState: string;
    checkedAt: string;
  } | null;
  observation: AccountObservation | null;
  observationStale: boolean;
  media: { paidCallsAllowed: boolean; callsPerHour: number };
};
export default function AbacusHub() {
  const [hub, setHub] = useState<Hub | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<MediaKind>("image"),
    [model, setModel] = useState("flux2"),
    [prompt, setPrompt] = useState(""),
    [image, setImage] = useState("");
  const [result, setResult] = useState<{
    text: string;
    kind: string;
    asset?: string;
    inlineAsset?: string;
    model: string;
  } | null>(null);
  const [plan, setPlan] = useState("unknown"),
    [credits, setCredits] = useState(""),
    [services, setServices] = useState(""),
    [connectorCount, setConnectorCount] = useState(""),
    [mcpCount, setMcpCount] = useState(""),
    [installedMcp, setInstalledMcp] = useState("");
  const [tasks, setTasks] = useState(""),
    [agents, setAgents] = useState("");
  const controller = useRef<AbortController | null>(null),
    objectUrl = useRef<string | null>(null);
  const [assetUrl, setAssetUrl] = useState("");
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/director/abacus/hub", { cache: "no-store", signal: ac.signal })
      .then(async (r) => {
        if (!r.ok)
          throw Error("Entre como proprietário para consultar a Abacus.");
        setHub(await r.json());
      })
      .catch((e) => {
        if (!ac.signal.aborted) setError(e.message);
      });
    return () => {
      ac.abort();
      controller.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);
  async function request(path: string, options: RequestInit = {}) {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(path, {
          ...options,
          signal: ac.signal,
          cache: "no-store",
          credentials: "same-origin",
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error || "Operação indisponível.");
      return d;
    } catch (e) {
      if (!ac.signal.aborted)
        setError(e instanceof Error ? e.message : "Operação indisponível.");
      return null;
    } finally {
      if (controller.current === ac) {
        controller.current = null;
        setBusy(false);
      }
    }
  }
  async function inspect() {
    const d = await request("/api/director/abacus/hub?verify=1");
    if (d) setHub(d);
  }
  async function save() {
    const n = (s: string) => (s === "" ? null : Number(s));
    const body = {
      activeTasks: tasks
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean),
      personalAgents: agents
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean),
      plan,
      remainingCredits: n(credits),
      observedAt: new Date().toISOString(),
      connectedServices: services
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      connectorCatalogCount: n(connectorCount),
      mcpCatalogCount: n(mcpCount),
      installedMcpCount: n(installedMcp),
    };
    const d = await request("/api/director/abacus/hub", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (d)
      setHub((h) =>
        h ? { ...h, observation: d.observation, observationStale: false } : h,
      );
  }
  async function generate() {
    setResult(null);
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setAssetUrl("");
    const d = await request("/api/director/abacus/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        model,
        prompt,
        ...(kind === "vision" ? { image } : {}),
      }),
    });
    if (!d) return;
    setResult(d);
    if (d.inlineAsset) {
      const match =
        /^data:((?:image\/(?:png|jpeg|webp))|audio\/mpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          d.inlineAsset,
        );
      if (match) {
        const b = atob(match[2]),
          bytes = Uint8Array.from(b, (c) => c.charCodeAt(0));
        objectUrl.current = URL.createObjectURL(
          new Blob([bytes], { type: match[1] }),
        );
        setAssetUrl(objectUrl.current);
      }
    } else if (d.asset) setAssetUrl(d.asset);
  }
  async function loadImage(file?: File) {
    setImage("");
    if (!file) return;
    if (
      file.size > 1400000 ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.type)
    ) {
      setError("Escolha PNG, JPEG ou WebP de até 1,4 MB.");
      return;
    }
    const value = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    }).catch(() => "");
    if (value) setImage(value);
    else setError("Não foi possível ler a imagem.");
  }
  const allowedModels = hub?.discovery?.models.map((m) => m.id);
  const models = (MEDIA_MODELS[kind] as readonly string[]).filter(
    (m) => !allowedModels || allowedModels.includes(m),
  );
  return (
    <section
      className="glass notice"
      aria-label="Abacus: recursos e laboratório"
      style={{ margin: "1.5rem 0", padding: 20 }}
    >
      <h2>Abacus: recursos e laboratório</h2>
      <p>
        Modelos, ferramentas e recursos da conta em um só lugar. Consultar
        catálogos não executa gerações.
      </p>
      <button onClick={inspect} disabled={busy}>
        Atualizar modelos e ferramentas da conta
      </button>
      {busy ? (
        <button
          onClick={() => {
            controller.current?.abort();
            setBusy(false);
          }}
        >
          Cancelar operação
        </button>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {hub ? (
        <p role="status">
          Catálogo:{" "}
          {hub.state === "verified"
            ? "verificado"
            : hub.state === "not_checked"
              ? "ainda não consultado"
              : "não confirmado"}
          .{" "}
          {hub.discovery
            ? hub.discovery.models.length +
              " modelos · " +
              (hub.discovery.toolsState === "verified"
                ? hub.discovery.tools.length + " ferramentas publicadas"
                : "ferramentas não verificadas")
            : ""}
        </p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 12,
          margin: "1rem 0",
        }}
      >
        {ABACUS_SURFACES.map((s) => (
          <article key={s.id}>
            <strong>{s.name}</strong>
            <p>
              {s.access === "api_read"
                ? "Consulta integrada"
                : s.implemented
                  ? "Integração disponível; execução depende de acesso e orçamento"
                  : "Área da Abacus; execução pelo JK ainda não integrada"}
            </p>
            <a href={s.href} target="_blank" rel="noreferrer">
              Abrir referência
            </a>
          </article>
        ))}
      </div>
      {hub?.discovery ? (
        <details>
          <summary>Modelos e ferramentas descobertos</summary>
          <p>
            Preço publicado só aparece quando o catálogo fornece um campo
            reconhecido; não é saldo nem orçamento.
          </p>
          <ul>
            {hub.discovery.models.map((m) => (
              <li key={m.id}>
                {m.id}
                {Object.keys(m.priceMetadata).length
                  ? " · metadados de preço: " + JSON.stringify(m.priceMetadata)
                  : ""}
              </li>
            ))}
          </ul>
          <ul>
            {hub.discovery.tools.map((t) => (
              <li key={t.name}>
                <strong>{t.name}</strong>: {t.description} ·{" "}
                {t.supported ? "compatível com API" : "não suportada na API"} ·
                execução não autorizada automaticamente
                {t.requiresConnectors.length
                  ? " · requer " + t.requiresConnectors.join(", ")
                  : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <details>
        <summary>Observação privada da conta</summary>
        <p>
          Importe somente informações vistas na conta. O registro é datado e
          criptografado no cofre de conectores, separado do histórico da
          conversa. Não insira senhas, chaves ou números de pagamento.
        </p>
        {hub?.observation ? (
          <p>
            Plano observado: {hub.observation.plan} · saldo observado:{" "}
            {hub.observation.remainingCredits ?? "não informado"} ·{" "}
            {new Date(hub.observation.observedAt).toLocaleString("pt-BR")}
            {hub.observationStale ? " · observação antiga" : ""}. Serviços:{" "}
            {hub.observation.connectedServices.join(", ") || "nenhum informado"}
            .
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label>
            Plano observado{" "}
            <select
              aria-label="Plano observado"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            >
              <option value="unknown">Não confirmado</option>
              <option>Basic</option>
              <option>Pro</option>
              <option>Max</option>
            </select>
          </label>
          <label>
            Créditos restantes observados{" "}
            <input
              type="number"
              min="0"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </label>
          <label>
            Serviços já conectados na Abacus{" "}
            <input
              value={services}
              onChange={(e) => setServices(e.target.value)}
              placeholder="Separe por vírgula"
            />
          </label>
          <label>
            Opções no catálogo de conectores{" "}
            <input
              type="number"
              min="0"
              value={connectorCount}
              onChange={(e) => setConnectorCount(e.target.value)}
            />
          </label>
          <label>
            Opções no catálogo MCP{" "}
            <input
              type="number"
              min="0"
              value={mcpCount}
              onChange={(e) => setMcpCount(e.target.value)}
            />
          </label>
          <label>
            Tarefas ativas observadas{" "}
            <input
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
              placeholder="Separe por ponto e vírgula"
            />
          </label>
          <label>
            Agentes pessoais observados{" "}
            <input
              value={agents}
              onChange={(e) => setAgents(e.target.value)}
              placeholder="Separe por ponto e vírgula"
            />
          </label>
          <label>
            Servidores MCP instalados{" "}
            <input
              type="number"
              min="0"
              value={installedMcp}
              onChange={(e) => setInstalledMcp(e.target.value)}
            />
          </label>
        </div>
        <button onClick={save} disabled={busy}>
          Salvar observação criptografada
        </button>
      </details>
      <details>
        <summary>Criar e analisar com a Abacus</summary>
        <p>
          Uma execução usa créditos da API. O botão executa um pedido concreto
          dentro da autorização e dos limites já configurados no servidor; não
          compra créditos nem ativa recarga. Limites por instância não garantem
          um teto financeiro global. Sem orçamento autorizado, o pedido é
          bloqueado.
        </p>
        <label>
          Tipo de tarefa{" "}
          <select
            aria-label="Tipo de tarefa"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as MediaKind;
              setKind(k);
              setModel(MEDIA_MODELS[k][0]);
            }}
          >
            <option value="image">Criar imagem</option>
            <option value="audio">Criar áudio</option>
            <option value="vision">Analisar imagem</option>
          </select>
        </label>{" "}
        <label>
          Modelo Abacus{" "}
          <select
            aria-label="Modelo Abacus"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "block" }}>
          Pedido para a Abacus{" "}
          <textarea
            aria-label="Pedido para a Abacus"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={1500}
            rows={3}
            style={{ width: "100%" }}
          />
        </label>
        {kind === "vision" ? (
          <label>
            Imagem para análise{" "}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void loadImage(e.target.files?.[0])}
            />
          </label>
        ) : null}
        <button
          disabled={
            busy ||
            !prompt.trim() ||
            !hub?.media.paidCallsAllowed ||
            !hub.discovery ||
            !models.includes(model) ||
            (kind === "vision" && !image)
          }
          onClick={generate}
        >
          Executar pedido com créditos autorizados
        </button>
        {!hub?.media.paidCallsAllowed ? (
          <p>
            Geração bloqueada: orçamento de API não autorizado neste ambiente.
          </p>
        ) : null}
        {result ? (
          <div role="status">
            <p>{result.text}</p>
            <small>Modelo retornado: {result.model}</small>
            {assetUrl && result.kind === "image" ? (
              <img
                src={assetUrl}
                alt="Imagem sintética criada pela Abacus"
                style={{ maxWidth: "100%", maxHeight: 520 }}
              />
            ) : null}
            {assetUrl && result.kind === "audio" ? (
              <audio
                controls
                src={assetUrl}
                aria-label="Áudio criado pela Abacus"
              />
            ) : null}
            {assetUrl ? (
              <p>
                <a
                  href={assetUrl}
                  download={
                    result.kind === "audio"
                      ? "jarvis-audio.mp3"
                      : "jarvis-imagem.png"
                  }
                >
                  Salvar resultado
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
      </details>
      <p>
        Vídeo e agentes: abra o Studio ou o aplicativo Abacus. O JK não
        reutiliza a sessão do navegador como chave de API nem herda
        automaticamente os conectores desta conversa.
      </p>
    </section>
  );
}
