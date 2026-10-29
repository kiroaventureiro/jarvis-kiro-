"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  Provider,
  Grant,
  Resource,
  Action,
} from "../../lib/connectors/types";
import type { Operation } from "../../lib/connectors/catalog";
type Connection = {
  id: string;
  revision: number;
  status: string;
  mode: string;
  verifiedAt: string | null;
  account: string;
  grants: Grant[];
  resources: Resource[];
  providerScopes: string[];
  lastError?: string;
};
type View = {
  provider: Provider;
  oauthConfigured: boolean;
  connection: Connection | null;
  operations: Operation[];
  writeAllowlist: string[];
  revocationUrl: string;
};
type PlanView = {
  id: string;
  title: string;
  digest: string;
  status: string;
  confirmation: string;
  createdAt: number;
  expiresAt: number;
  steps: Array<{
    action: Action;
    status: string;
    result?: unknown;
    error?: string;
  }>;
};
type Overview = {
  configured: boolean;
  environment: string;
  providers: View[];
  plans: PlanView[];
  audit: Array<{
    id: string;
    at: string;
    provider?: Provider;
    operation: string;
    resource?: string;
    outcome: string;
  }>;
  kiroProjects: Array<{ id: string; name: string }>;
};
const names = {
  github: "GitHub",
  supabase: "Supabase administrativo",
  vercel: "Vercel",
};
async function api(data: unknown) {
  const r = await fetch("/api/director/connectors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(data),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Operação não concluída.");
  return body;
}
export default function NativeConnectors() {
  const [view, setView] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [verification, setVerification] = useState<Array<{provider:Provider;state:"verified"|"not_connected"|"failed"}>>([]),
    [abacusVerification,setAbacusVerification]=useState<{state:string;models:number;tools:number;toolsState:string;checkedAt:string|null}|null>(null),
    [studioVerification,setStudioVerification]=useState<string|null>(null),
    [loading, setLoading] = useState(false);
  async function load() {
    const r = await fetch("/api/director/connectors", {
        cache: "no-store",
        credentials: "same-origin",
      }),
      body = await r.json();
    if (!r.ok) throw new Error(body.error || "Conectores indisponíveis.");
    setView(body);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/director/connectors", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Conectores indisponíveis.");
        if (active) setView(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (view?.plans.length && window.location.hash.startsWith("#plan-"))
      document
        .getElementById(window.location.hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  }, [view?.plans.length]);
  async function refresh() {
    setLoading(true);
    try {
      await load();
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setLoading(false);
    }
  }
  async function verifySaved() {
    setLoading(true);setError("");setVerification([]);setAbacusVerification(null);setStudioVerification(null);
    try {
      const result=await api({op:"verify_saved"});
      setVerification(result.results);
      setAbacusVerification(result.abacus);
      setStudioVerification(result.voiceStudio?.state||null);
      await load();
    } catch(e) {
      setError(e instanceof Error?e.message:"Não foi possível verificar as conexões salvas.");
    } finally {setLoading(false);}
  }
  return (
    <section
      id="native-connectors"
      className="native-connectors"
      aria-label="Conectores nativos de desenvolvimento"
    >
      <div className="connector-heading">
        <div>
          <p className="eyebrow">DESENVOLVIMENTO AUTORIZADO</p>
          <h2>Contas e projetos do JK</h2>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>
          Atualizar conectores
        </button>
      </div>
      <button type="button" onClick={verifySaved} disabled={loading || !view}>
        {loading ? "Consultando conexões…" : "Verificar Abacus e contas já autorizadas"}
      </button>
      <p>Consulta Abacus, GitHub, Supabase, Vercel e VoiceStudio com a configuração já salva. Não solicita novos tokens, não gera conteúdo pago, não altera permissões e não inicia tarefas ou deploys.</p>
      {abacusVerification ? <div role="status">
        <p>Abacus: {abacusVerification.state==="verified"
          ? `catálogo autenticado verificado (${abacusVerification.models} modelos). ${abacusVerification.toolsState==="verified"?`${abacusVerification.tools} ferramentas listadas.`:"Ferramentas não verificadas."}`
          :abacusVerification.state==="not_configured"?"chave não configurada neste ambiente":"não foi possível confirmar o acesso"}</p>
        {abacusVerification.checkedAt ? <p>Consulta do catálogo: {new Date(abacusVerification.checkedAt).toLocaleString("pt-BR")}.</p> : null}
        <p>Geração de conteúdo e execução de agentes não testadas. Conectores do ChatLLM não são transferidos ao Jarvis.</p>
      </div> : null}
      {studioVerification ? <p role="status">VoiceStudio: {studioVerification==="read_verified"?"descoberta e leitura verificadas; geração de voz não testada":studioVerification==="not_configured"?"serviço não configurado":"acesso não confirmado ("+studioVerification+")"}.</p> : null}
      {verification.length ? <ul aria-label="Resultado da verificação de contas" role="status">
        {verification.map(item=><li key={item.provider}>{names[item.provider]}: {item.state==="verified"?"acesso verificado agora":item.state==="not_connected"?"autorização ainda não cadastrada":"verificação falhou; consulte o conector abaixo"}</li>)}
      </ul> : null}
      <p>
        Conecte uma conta, escolha os projetos e conceda permissões ao JK.
        Gravações e deploys exigem um plano aprovado. Arquivos e logs são
        tratados como dados externos, sem autoridade para executar ações.
      </p>
      {error ? (
        <p role="alert">
          {error} <Link href="/configuracoes">Acesso do proprietário</Link>
        </p>
      ) : null}
      {view && !view.configured ? (
        <aside className="glass notice">
          <strong>Configuração inicial necessária</strong>
          <p>
            O cofre dedicado dos conectores ainda não está configurado. Nenhuma
            conta foi conectada. O administrador precisa cadastrar o
            armazenamento criptografado, os aplicativos OAuth e a URL estável de
            callback no servidor. A memória do Supabase continua separada.
          </p>
          <p>
            Os botões serão liberados após essa configuração. Não envie tokens
            na conversa com a IA.
          </p>
        </aside>
      ) : null}
      {view ? (
        <>
          <p className="connector-environment">
            Ambiente: <strong>{view.environment}</strong> · produção e merge
            bloqueados
          </p>
          <div className="connector-grid">
            {view.providers.map((p) => (
              <ProviderCard
                key={p.provider}
                value={p}
                enabled={view.configured}
                projects={view.kiroProjects}
                onChange={refresh}
              />
            ))}
          </div>
          <RepairPanel
            enabled={view.configured}
            projects={view.kiroProjects}
            onChange={refresh}
          />
          <h3>Planos e resultados</h3>
          <p>
            Revise os parâmetros completos. Commits e PRs podem acionar
            automações já configuradas no provedor. O Preview explícito do plano
            de correção aguarda os testes; automações existentes são
            independentes.
          </p>
          {!view.plans.length ? (
            <p>Nenhum plano preparado.</p>
          ) : (
            view.plans.map((p) => (
              <PlanCard
                key={p.id + ":" + p.status}
                plan={p}
                onChange={refresh}
              />
            ))
          )}
          <details className="glass connector-history">
            <summary>
              Histórico de ações ({view.audit.length} registros recentes)
            </summary>
            <ol>
              {view.audit.map((a) => (
                <li key={a.id}>
                  <time>{new Date(a.at).toLocaleString("pt-BR")}</time> ·{" "}
                  {a.provider || "JK"} · {a.operation} · {a.resource || ""} ·{" "}
                  <strong>{a.outcome}</strong>
                </li>
              ))}
            </ol>
            <p>
              Retenção limitada aos registros recentes. Tokens e conteúdos
              secretos não fazem parte deste histórico.
            </p>
          </details>
        </>
      ) : !error ? (
        <p role="status">Consultando conectores…</p>
      ) : null}
    </section>
  );
}
function ProviderCard({
  value: v,
  enabled,
  projects,
  onChange,
}: {
  value: View;
  enabled: boolean;
  projects: Overview["kiroProjects"];
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [manual, setManual] = useState(false),
    [token, setToken] = useState(""),
    [teamId, setTeamId] = useState(""),
    [available, setAvailable] = useState<Resource[]>([]),
    [selected, setSelected] = useState<Resource[]>(
      v.connection?.resources || [],
    ),
    [grants, setGrants] = useState<Grant[]>(v.connection?.grants || ["read"]),
    [op, setOp] = useState(v.operations[0].id),
    [args, setArgs] = useState<Record<string, string>>({}),
    [resource, setResource] = useState(v.connection?.resources[0]?.id || "");
  useEffect(() => {
    setSelected(v.connection?.resources || []);
    setGrants(v.connection?.grants || ["read"]);
    setResource(v.connection?.resources[0]?.id || "");
  }, [v.connection?.id, v.connection?.revision]);
  const definition = v.operations.find((x) => x.id === op)!;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    await run(async () => {
      const result = await api({ op: "test", provider: v.provider });
      setAvailable(result.resources);
      setNotice(
        "Leitura do provedor validada. Escolha e salve os projetos autorizados.",
      );
      await onChange();
    });
  }
  function toggle(r: Resource, checked: boolean) {
    setSelected((items) =>
      checked ? [...items, r] : items.filter((i) => i.id !== r.id),
    );
  }
  const c = v.connection;
  return (
    <article
      className="glass connector-card"
      aria-label={"Conector " + names[v.provider]}
    >
      <h3>{names[v.provider]}</h3>
      <p>
        <strong>
          {c?.status === "connected"
            ? c.verifiedAt
              ? "Autenticação validada"
              : "Credencial armazenada; teste pendente"
            : c?.status === "revocation_pending"
              ? "Revogação no provedor pendente"
              : "Desconectado do JK"}
        </strong>
      </p>
      {c ? (
        <>
          <p>{c.account}</p>
          <p>
            Último teste:{" "}
            {c.verifiedAt
              ? new Date(c.verifiedAt).toLocaleString("pt-BR")
              : "não confirmado"}
          </p>
          <p>Permissões concedidas no JK: {c.grants.join(", ") || "nenhuma"}</p>
          <p>
            Escopos informados pelo provedor:{" "}
            {c.providerScopes.join(", ") ||
              "não informados; as restrições do provedor continuam aplicáveis"}
          </p>
          {c.lastError ? (
            <p role="status">
              A validação precisa ser refeita ({c.lastError}).
            </p>
          ) : null}
        </>
      ) : null}
      <div className="connector-buttons">
        <button
          type="button"
          disabled={!enabled || busy || !v.oauthConfigured}
          onClick={() =>
            run(async () => {
              const r = await api({ op: "connect", provider: v.provider });
              const u = new URL(r.authorizationUrl);
              if (
                !["github.com", "api.supabase.com", "vercel.com"].includes(
                  u.hostname,
                ) ||
                u.protocol !== "https:"
              )
                throw Error("Destino de autorização inválido.");
              window.location.assign(u.href);
            })
          }
        >
          Conectar {names[v.provider]}
        </button>
        <button
          type="button"
          disabled={!enabled || busy}
          onClick={() => setManual(!manual)}
        >
          Usar token no formulário seguro
        </button>
      </div>
      {!v.oauthConfigured ? (
        <p className="connector-hint">
          OAuth depende do cadastro prévio do aplicativo deste provedor.
        </p>
      ) : null}
      {manual ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              try {
                await api({ op: "token", provider: v.provider, token, teamId });
                setManual(false);
                setNotice(
                  "Credencial recebida. Consulte o resultado do teste e configure o escopo.",
                );
                await onChange();
              } finally {
                setToken("");
              }
            });
          }}
        >
          <label>
            Token administrativo de {names[v.provider]}
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              maxLength={10000}
              required
            />
          </label>
          {v.provider === "vercel" ? (
            <label>
              ID da equipe (opcional)
              <input
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                autoComplete="off"
              />
            </label>
          ) : null}
          <p>
            Enviado diretamente ao servidor e armazenado criptografado. Não é
            salvo no navegador, no chat ou no histórico. No Supabase, use token
            da Management API; a service role da memória não é aceita.
          </p>
          <button disabled={busy || !enabled || !token}>
            Conectar e validar token
          </button>
        </form>
      ) : null}
      {c?.status === "connected" ? (
        <>
          <div className="connector-buttons">
            <button type="button" disabled={busy} onClick={test}>
              Testar conexão e listar projetos
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (
                    !window.confirm(
                      "Apagar a credencial deste conector no JK? A autorização no provedor poderá continuar ativa.",
                    )
                  )
                    return;
                  await api({
                    op: "disconnect",
                    provider: v.provider,
                    confirmation: "DESCONECTAR " + v.provider,
                  });
                  await onChange();
                })
              }
            >
              Desconectar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (
                    !window.confirm(
                      "Revogar o acesso deste aplicativo no provedor e desativá-lo no JK? Tokens manuais exigem revogação no painel do provedor.",
                    )
                  )
                    return;
                  const result = await api({
                    op: "revoke",
                    provider: v.provider,
                    confirmation: "REVOGAR " + v.provider,
                  });
                  setNotice(
                    result.remoteRevoked
                      ? "Autorização revogada no provedor."
                      : "Acesso local desativado; confirme a revogação no painel do provedor.",
                  );
                  await onChange();
                })
              }
            >
              Revogar permissões
            </button>
          </div>
          <details>
            <summary>Escopo de projetos e permissões</summary>
            <p>
              Selecione até 20 recursos. A listagem é limitada; se o recurso não
              aparecer, restrinja a instalação no provedor.
            </p>
            {(available.length ? available : c.resources).map((r) => (
              <div key={r.id} className="connector-resource">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.some((s) => s.id === r.id)}
                    onChange={(e) => toggle(r, e.target.checked)}
                  />
                  {r.name} <small>{r.id}</small>
                </label>
                {selected.some((s) => s.id === r.id) ? (
                  <>
                    <label>
                      Projeto KIRO vinculado
                      <select
                        value={
                          selected.find((s) => s.id === r.id)?.kiroProject || ""
                        }
                        onChange={(e) =>
                          setSelected((items) =>
                            items.map((s) =>
                              s.id === r.id
                                ? {
                                    ...s,
                                    kiroProject: e.target.value || undefined,
                                  }
                                : s,
                            ),
                          )
                        }
                      >
                        <option value="">Sem vínculo</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {v.provider === "supabase" ? (
                      <label>
                        Ambiente do banco
                        <select
                          value={
                            selected.find((s) => s.id === r.id)?.environment ||
                            "production"
                          }
                          onChange={(e) =>
                            setSelected((items) =>
                              items.map((s) =>
                                s.id === r.id
                                  ? {
                                      ...s,
                                      environment:
                                        e.target.value === "development"
                                          ? "development"
                                          : "production",
                                    }
                                  : s,
                              ),
                            )
                          }
                        >
                          <option value="production">
                            Produção — somente leitura
                          </option>
                          <option value="development">
                            Desenvolvimento — exige allowlist do servidor
                          </option>
                        </select>
                      </label>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))}
            <fieldset>
              <legend>Permissões locais do JK</legend>
              {(
                [
                  "read",
                  ...(v.provider === "vercel"
                    ? ["deploy", "configure"]
                    : ["write"]),
                ] as Grant[]
              ).map((g) => (
                <label key={g}>
                  <input
                    type="checkbox"
                    checked={grants.includes(g)}
                    disabled={g === "read"}
                    onChange={(e) =>
                      setGrants((items) =>
                        e.target.checked
                          ? [...items, g]
                          : items.filter((i) => i !== g),
                      )
                    }
                  />
                  {g === "read"
                    ? "Consultar"
                    : g === "write"
                      ? "Preparar alterações aprovadas"
                      : g === "deploy"
                        ? "Preparar Preview aprovado"
                        : "Configurar variável da branch Preview"}
                </label>
              ))}
            </fieldset>
            <p>
              Escrita também depende da allowlist de desenvolvimento do
              servidor. Recursos liberados nela:{" "}
              {v.writeAllowlist.join(", ") || "nenhum"}.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api({
                    op: "scope",
                    provider: v.provider,
                    resources: selected,
                    grants,
                  });
                  setNotice(
                    "Escopo salvo; planos anteriores devem ser preparados novamente.",
                  );
                  await onChange();
                })
              }
            >
              Salvar escopo autorizado
            </button>
          </details>
          {c.resources.length ? (
            <details>
              <summary>Preparar uma operação</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await api({
                      op: "plan",
                      title: definition.label,
                      actions: [
                        { provider: v.provider, resource, operation: op, args },
                      ],
                    });
                    setArgs({});
                    setNotice(
                      "Plano preparado. Revise abaixo antes de executar.",
                    );
                    await onChange();
                  });
                }}
              >
                <label>
                  Projeto autorizado
                  <select
                    value={resource}
                    onChange={(e) => setResource(e.target.value)}
                  >
                    {c.resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Operação
                  <select
                    value={op}
                    onChange={(e) => {
                      setOp(e.target.value);
                      setArgs({});
                    }}
                  >
                    {v.operations.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {definition.fields.map((f) => (
                  <label key={f.key}>
                    {f.label}
                    {f.kind === "textarea" && op !== "preview_env" ? (
                      <textarea
                        required={!f.optional}
                        value={args[f.key] || ""}
                        placeholder={f.hint}
                        maxLength={30000}
                        onChange={(e) =>
                          setArgs((a) => ({ ...a, [f.key]: e.target.value }))
                        }
                      />
                    ) : (
                      <input
                        type={
                          op === "preview_env" && f.key === "value"
                            ? "password"
                            : f.kind === "number"
                              ? "number"
                              : "text"
                        }
                        autoComplete="off"
                        required={!f.optional}
                        value={args[f.key] || ""}
                        placeholder={f.hint}
                        onChange={(e) =>
                          setArgs((a) => ({ ...a, [f.key]: e.target.value }))
                        }
                      />
                    )}
                  </label>
                ))}
                <button disabled={busy}>Preparar plano para revisão</button>
              </form>
            </details>
          ) : (
            <p>Nenhum projeto foi autorizado no JK.</p>
          )}
        </>
      ) : c?.status === "revocation_pending" ? (
        <button
          type="button"
          onClick={() =>
            run(async () => {
              await api({
                op: "revoke",
                provider: v.provider,
                confirmation: "REVOGAR " + v.provider,
              });
              await onChange();
            })
          }
        >
          Tentar revogação novamente
        </button>
      ) : null}
      <a href={v.revocationUrl} target="_blank" rel="noreferrer">
        Gerenciar autorizações no provedor ↗
      </a>
      {notice ? (
        <p role="status" className="connector-notice">
          {notice}
        </p>
      ) : null}
    </article>
  );
}
function PlanCard({
  plan: p,
  onChange,
}: {
  plan: PlanView;
  onChange: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const changes = p.steps.some(
    (s) =>
      ![
        "repo",
        "file",
        "branches",
        "commits",
        "issues",
        "pulls",
        "checks",
        "workflow_safety",
        "schemas",
        "select",
        "diagnostics",
        "logs",
        "project",
        "deployments",
        "build_logs",
        "runtime_logs",
      ].includes(s.action.operation),
  );
  async function run(op: string) {
    setBusy(true);
    try {
      await api({ op, id: p.id, digest: p.digest, confirmation });
      await onChange();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao executar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="glass connector-plan" id={"plan-" + p.id}>
      <h4>{p.title}</h4>
      <p>
        Estado: <strong>{p.status}</strong> · validade:{" "}
        {new Date(p.expiresAt).toLocaleTimeString("pt-BR")}
      </p>
      <ol>
        {p.steps.map((s, i) => (
          <li key={i}>
            <strong>
              {s.action.provider} · {s.action.operation}
            </strong>
            <p>
              {s.action.resource} · {s.status}
              {s.error ? " · " + s.error : ""}
            </p>
            <details>
              <summary>Parâmetros exatos</summary>
              <pre>{JSON.stringify(s.action.args, null, 2)}</pre>
            </details>
            {s.result !== undefined ? (
              <details open={p.steps.length === 1}>
                <summary>Resultado verificado</summary>
                <pre>{JSON.stringify(s.result, null, 2)}</pre>
              </details>
            ) : null}
          </li>
        ))}
      </ol>
      {p.status === "draft" && changes ? (
        <div>
          <p>
            Esta aprovação vale somente para o plano e escopo exibidos. Nenhum
            texto vindo de arquivo, log ou IA equivale à sua autorização.
          </p>
          <label>
            Digite {p.confirmation}
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </label>
          <button
            disabled={busy || confirmation !== p.confirmation}
            onClick={() => run("approve")}
          >
            Aprovar este plano
          </button>
        </div>
      ) : null}
      {["approved", "waiting"].includes(p.status) ||
      (p.status === "draft" && !changes) ? (
        <button disabled={busy} onClick={() => run("execute")}>
          {p.status === "waiting"
            ? "Continuar plano pendente"
            : "Executar plano"}
        </button>
      ) : null}
      {["draft", "approved", "waiting"].includes(p.status) ? (
        <button disabled={busy} onClick={() => run("cancel")}>
          Cancelar plano
        </button>
      ) : null}
      {p.status === "uncertain" || p.status === "running" ? (
        <p>
          Não repita a gravação. Confirme o resultado no provedor; uma operação
          já enviada pode concluir mesmo após desconexão.
        </p>
      ) : null}
      {notice ? <p role="alert">{notice}</p> : null}
    </article>
  );
}
function RepairPanel({
  enabled,
  projects,
  onChange,
}: {
  enabled: boolean;
  projects: Overview["kiroProjects"];
  onChange: () => Promise<void>;
}) {
  const [project, setProject] = useState(projects[0]?.id || ""),
    [request, setRequest] = useState(""),
    [paths, setPaths] = useState("app/page.tsx"),
    [authorize, setAuthorize] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedProject = params.get("repairProject");
    const requestedText = params.get("repairRequest");
    const requestedPaths = params.get("repairPaths");
    if (requestedProject && projects.some((p) => p.id === requestedProject))
      setProject(requestedProject);
    if (requestedText) setRequest(requestedText.slice(0, 700));
    if (requestedPaths) setPaths(requestedPaths.slice(0, 700));
    // A deep link may fill the form but never authorize AI cost or execute a write.
  }, [projects]);
  async function run(mode: string) {
    setBusy(true);
    setNotice("");
    try {
      const r = await fetch("/api/director/connectors/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          project,
          request,
          paths: paths
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          authorizeModel: authorize,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Proposta indisponível.");
      setNotice(
        mode === "diagnose"
          ? "Diagnóstico preparado; consulte o resultado abaixo."
          : "Proposta preparada; nenhuma gravação foi executada.",
      );
      await onChange();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha no planejamento.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="glass connector-repair"
      aria-label="Planejamento de correções"
    >
      <h3>Diagnóstico e proposta de correção</h3>
      <p>
        Vincule o repositório e o projeto Vercel ao mesmo projeto KIRO. O
        diagnóstico usa somente leitura. A proposta é limitada a pequenas
        substituições nos arquivos escolhidos; toda gravação exige revisão e
        aprovação.
      </p>
      <label>
        Projeto KIRO
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button disabled={!enabled || busy} onClick={() => run("diagnose")}>
        Diagnosticar projeto autorizado
      </button>
      <label>
        Problema a corrigir
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          maxLength={700}
        />
      </label>
      <label>
        Até três arquivos, separados por vírgula
        <input value={paths} onChange={(e) => setPaths(e.target.value)} />
      </label>
      <label className="connector-check">
        <input
          type="checkbox"
          checked={authorize}
          onChange={(e) => setAuthorize(e.target.checked)}
        />
        Autorizo uma chamada da Abacus para preparar a proposta, somente se o
        orçamento já configurado permitir.
      </label>
      <button
        disabled={!enabled || busy || !authorize || !request.trim()}
        onClick={() => run("propose")}
      >
        Preparar proposta com IA
      </button>
      <p>
        O plano cria uma branch jk/, aplica o diff aprovado e abre PR em
        rascunho. O CI deve usar runners hospedados reconhecidos. O Preview
        explícito aguarda testes confirmados. O JK não executa comandos locais,
        merge ou promoção para produção.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
