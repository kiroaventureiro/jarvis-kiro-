"use client";
import { useEffect, useMemo, useState } from "react";
import {
  DRAFT_STORAGE_KEY,
  restoreDrafts,
  validateConnection,
  type ConnectionDraft,
} from "../../lib/integration-registry";
type Service = {
  name: string;
  category: string;
  purpose: string;
  connectionStrategy: string;
};
const categories: Record<string, string> = {
  social: "Redes sociais",
  productivity: "Produtividade",
  development: "Desenvolvimento",
  deployment: "Hospedagem",
  database: "Dados",
  automation: "Automação",
  streaming: "Transmissão",
  broadcast: "Televisão",
  design: "Design",
  music_creation: "Música",
  video_creation: "Vídeo",
  video_editing: "Edição",
  ai_video: "Inteligência artificial",
  hosting: "Hospedagem",
  mobile: "Dispositivos",
  distribution: "Distribuição",
  commerce: "Comércio",
  analytics: "Análise",
  live_monetization: "Monetização",
};
export default function IntegrationCenter({
  services,
}: {
  services: Service[];
}) {
  const [drafts, setDrafts] = useState<ConnectionDraft[]>([]),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [context, setContext] = useState("all"),
    [showForm, setShowForm] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("all");
  useEffect(() => {
    try {
      setDrafts(restoreDrafts(localStorage.getItem(DRAFT_STORAGE_KEY)));
    } catch {
      setMessage(
        "O armazenamento local está indisponível. Os novos cadastros ficarão apenas nesta sessão.",
      );
    }
    setReady(true);
  }, []);
  const entries = useMemo(
    () => [
      ...services.map((s, i) => ({
        ...s,
        id: "catalog-" + i,
        accountLabel: "Conta a definir",
        context: "unassigned",
        permissions: "Nenhuma permissão concedida",
        state: "planned" as const,
        origin: "catalog",
      })),
      ...drafts.map((d) => ({
        ...d,
        connectionStrategy: "Adaptador e autorização pendentes",
        origin: "local",
      })),
    ],
    [services, drafts],
  );
  const filtered = entries.filter(
    (s) =>
      (category === "all" || s.category === category) &&
      (context === "all" || s.context === context) &&
      (status === "all" || s.state === status) &&
      [s.name, s.purpose, s.accountLabel]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const groups = Array.from(new Set(entries.map((e) => e.category))).sort();
  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const item = validateConnection(data, crypto.randomUUID());
      const next = [...drafts, item];
      let saved = true;
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        saved = false;
      }
      setDrafts(next);
      setMessage(
        saved
          ? "Cadastro planejado salvo neste navegador. Nenhuma conexão foi ativada."
          : "Cadastro adicionado apenas nesta sessão; armazenamento local indisponível.",
      );
      form.reset();
      setShowForm(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revise o cadastro.");
    }
  }
  return (
    <>
      <p className="intro">
        Organize serviços e contas pessoais ou profissionais. Cadastrar uma
        conexão não autoriza acesso: adaptadores, permissões e testes são etapas
        separadas.
      </p>
      <p>
        <span className="badge">{entries.length} cadastros</span>{" "}
        <span className="badge">0 conexões verificadas</span>
      </p>
      <button
        onClick={() => setShowForm(!showForm)}
        aria-expanded={showForm}
        aria-controls="connection-form"
      >
        {showForm ? "Fechar cadastro" : "+ Adicionar conexão"}
      </button>
      {showForm ? (
        <form
          id="connection-form"
          className="connection-form glass"
          onSubmit={add}
        >
          <h2>Nova conexão planejada</h2>
          <p className="intro">
            Somente metadados. Não informe credenciais. Cadastros locais não são
            sincronizados entre dispositivos.
          </p>
          <div className="form-grid">
            <label>
              Provedor
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Ex.: OpenAI"
              />
            </label>
            <label>
              Identificação da conta
              <input
                name="accountLabel"
                maxLength={80}
                placeholder="Ex.: Estúdio Kiro"
              />
            </label>
            <label>
              Categoria
              <input
                name="category"
                required
                maxLength={80}
                list="connection-categories"
              />
            </label>
            <datalist id="connection-categories">
              {groups.map((c) => (
                <option key={c} value={c}>
                  {categories[c] || c}
                </option>
              ))}
            </datalist>
            <label>
              Contexto
              <select name="context" defaultValue="professional">
                <option value="professional">Profissional</option>
                <option value="personal">Pessoal</option>
              </select>
            </label>
            <label className="wide">
              Finalidade
              <textarea name="purpose" required maxLength={500} />
            </label>
            <label className="wide">
              Permissões pretendidas, sem credenciais
              <textarea
                name="permissions"
                maxLength={500}
                placeholder="Ex.: leitura de métricas"
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={!ready}>
              Salvar cadastro planejado
            </button>
            <p>Não concede acesso nem executa ações externas.</p>
          </div>
        </form>
      ) : null}
      {message ? (
        <p className="status-message" role="status">
          {message}
        </p>
      ) : null}
      <div className="toolbar">
        <input
          aria-label="Pesquisar conexões"
          placeholder="Pesquisar conexões…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filtrar categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Todas as categorias</option>
          {groups.map((c) => (
            <option key={c} value={c}>
              {categories[c] || c}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar contexto"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        >
          <option value="all">Todos os contextos</option>
          <option value="personal">Pessoal</option>
          <option value="professional">Profissional</option>
          <option value="unassigned">Conta a definir</option>
        </select>
        <select
          aria-label="Filtrar estado"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Todos os estados</option>
          <option value="planned">Planejada</option>
          <option value="available">Disponível</option>
          <option value="authorized">Autorizada</option>
          <option value="verified">Verificada</option>
          <option value="expired">Expirada</option>
          <option value="error">Com erro</option>
        </select>
      </div>
      <p className="intro" role="status">
        {filtered.length} resultados. Os estados de autorização e verificação só
        serão preenchidos por adaptadores reais, após validação.
      </p>
      {filtered.length ? (
        groups.map((group) => {
          const items = filtered.filter((item) => item.category === group);
          return items.length ? (
            <section key={group}>
              <h2>{categories[group] || group}</h2>
              <div className="card-grid">
                {items.map((service) => (
                  <details className="card glass" key={service.id}>
                    <summary>
                      <strong>{service.name}</strong>{" "}
                      <span className="badge">Planejada</span>
                    </summary>
                    <p>{service.purpose}</p>
                    <p>
                      Conta: {service.accountLabel || "A definir"} ·{" "}
                      {service.context === "personal"
                        ? "Pessoal"
                        : service.context === "professional"
                          ? "Profissional"
                          : "Não definida"}
                    </p>
                    <p>
                      Permissões: {service.permissions || "Nenhuma solicitada"}
                    </p>
                    <p>Não autorizada · Não verificada</p>
                    <p>Método previsto: {service.connectionStrategy}</p>
                    <p>
                      {service.origin === "local"
                        ? "Cadastro local neste navegador"
                        : "Catálogo do projeto"}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ) : null;
        })
      ) : (
        <p className="empty-state">Nenhuma conexão corresponde aos filtros.</p>
      )}
    </>
  );
}
