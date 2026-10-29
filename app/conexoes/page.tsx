"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AbacusHub from "../components/AbacusHub";
import AbacusStatus from "../components/AbacusStatus";
import NativeConnectors from "../components/NativeConnectors";
import WorkspaceConnectors from "../components/WorkspaceConnectors";
import ObsConnection from "../components/ObsConnection";
import DeviceCamera from "../components/DeviceCamera";
import { connectionOption } from "../../lib/connection-options";
import { APP_SHORTCUTS } from "../../lib/codex/app-handoff";
type Item = {
  id: string;
  name: string;
  category: string;
  status: string;
  integration: string;
};
export default function ConnectionsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/director/connections", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Falha ao carregar");
        if (active) setItems(data.items);
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, []);
  const categories = useMemo(
    () => ["Todas", ...new Set(items.map((x) => x.category))],
    [items],
  );
  const shown = items.filter(
    (x) =>
      (category === "Todas" || x.category === category) &&
      x.name
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  ).sort((a,b)=>connectionOption(a.id,a.category).priority-connectionOption(b.id,b.category).priority);
  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "2rem 1rem",
        color: "inherit",
      }}
    >
      <Link href="/configuracoes">← Configurações</Link>
      <h1>Central de Conexões</h1>
      <section className="glass notice" aria-label="Abrir aplicativos">
        <h2>Abrir agora</h2>
        <p>Acesso direto aos aplicativos. Para o Jarvis ler ou alterar dados, use as autorizações e verificações dos conectores abaixo.</p>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          {APP_SHORTCUTS.map(app=><a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer">{app.name}</a>)}
          <Link href="/configuracoes">Ouvir e ajustar a voz</Link>
        </div>
      </section>
      <AbacusStatus />
      <AbacusHub />
      <NativeConnectors />
      <WorkspaceConnectors />
      <DeviceCamera />
      <ObsConnection />
      <section
        className="glass notice"
        aria-label="Consultas públicas integradas"
      >
        <h2>Consultas públicas sem novas credenciais</h2>
        <p>
          Estas fontes têm caminhos de consulta implementados no JK. A
          disponibilidade é confirmada em cada pesquisa; não representam contas
          privadas conectadas.
        </p>
        <ul>
          <li>
            Wikipedia: referências enciclopédicas. Exemplo: “Explique como
            funciona um semicondutor”.
          </li>
          <li>
            Wikimedia Commons: imagens com autoria e licença. Exemplo: “Busque
            imagens de florestas”.
          </li>
          <li>
            Crossref: artigos e DOI. Exemplo: “Pesquise artigos científicos
            sobre energia solar”.
          </li>
          <li>
            Open Library: livros e autoria. Exemplo: “Busque livros sobre
            cinema”.
          </li>
          <li>
            Banco Central e IBGE: indicadores econômicos já integrados, com
            período e fonte.
          </li>
        </ul>
        <p>
          Mapas e referências geográficas continuam disponíveis. Essas consultas
          não geram imagens, vídeos ou notícias verificadas automaticamente.
        </p>
      </section>
      <p>
        Explore plataformas de IA, redes sociais e ferramentas para a KIRO.
        Catálogo de possibilidades: a presença aqui não significa que a conta
        esteja conectada ou que exista integração oficial. Os conectores nativos
        acima têm autorização própria e são independentes deste catálogo.
      </p>
      <p>
        <strong>
          {items.length} serviços catalogados · autorizações reais exibidas nos conectores acima
        </strong>
      </p>
      <div
        style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "1rem 0" }}
      >
        <label>
          Buscar plataforma{" "}
          <input
            aria-label="Buscar plataforma"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar..."
          />
        </label>
        <label>
          Categoria{" "}
          <select
            aria-label="Filtrar categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert">{error}. Faça login nas Configurações.</p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(235px,1fr))",
          gap: 12,
        }}
      >
        {shown.map((x) => { const option=connectionOption(x.id,x.category); return (
          <article key={x.id} id={"catalog-"+x.id} className="glass card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: "1.1rem" }}>{x.name}</h2>
            <p>{x.category}</p>
            <p><strong>{option.status}</strong></p>
            <p>{option.requirement}</p>
            <p>Prioridade {option.priority === 0 ? "imediata" : option.priority === 1 ? "Kiro / contas principais" : option.priority === 2 ? "seguinte" : "posterior"}</p>
            {option.href ? <a href={option.href} {...(option.href.startsWith("https:") ? {target:"_blank",rel:"noopener noreferrer"} : {})}>{option.action}</a> : <p><small>Sem autorização disponível nesta versão.</small></p>}
          </article>
        );})}
      </div>
    </main>
  );
}
