"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AbacusHub from "../components/AbacusHub";
import AbacusStatus from "../components/AbacusStatus";
import NativeConnectors from "../components/NativeConnectors";
import WorkspaceConnectors from "../components/WorkspaceConnectors";
import ObsConnection from "../components/ObsConnection";
import DeviceCamera from "../components/DeviceCamera";
import { connectionOption, connectionInstructions } from "../../lib/connection-options";
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
      <details className="glass notice">
        <summary style={{cursor:"pointer",padding:8,fontWeight:600}}>Abrir aplicativos</summary>
        <p>Atalhos para seus aplicativos; abrir um site não conecta uma conta.</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {APP_SHORTCUTS.map(app=><a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer">{app.name}</a>)}
          <Link href="/configuracoes">Voz</Link>
        </div>
      </details>
      <details className="glass notice">
        <summary style={{cursor:"pointer",padding:8,fontWeight:600}}>Abacus AI e ferramentas</summary>
        <AbacusStatus />
        <AbacusHub />
      </details>
      <NativeConnectors />
      <details className="glass notice">
        <summary style={{cursor:"pointer",padding:8,fontWeight:600}}>Google e Microsoft</summary>
        <WorkspaceConnectors />
      </details>
      <details className="glass notice">
        <summary style={{cursor:"pointer",padding:8,fontWeight:600}}>Câmera</summary>
        <DeviceCamera />
      </details>
      <details className="glass notice">
        <summary style={{cursor:"pointer",padding:8,fontWeight:600}}>OBS e KIRO TV</summary>
        <ObsConnection />
      </details>
      <details className="glass notice">
        <summary style={{cursor:"pointer",padding:8,fontWeight:600}}>Consultas públicas disponíveis</summary>
        <p>Wikipedia, Wikimedia Commons, Crossref, Open Library, Banco Central e IBGE.
        A disponibilidade é verificada a cada consulta; não indica autorização de conta privada.</p>
      </details>
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
          <article key={x.id} id={"catalog-"+x.id} className="glass card" style={{padding:10}}>
            <details>
              <summary style={{cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:7}}>
                <strong>{x.name}</strong>
                <small style={{opacity:.8}}>{option.status}</small>
              </summary>
              <div style={{padding:"6px 8px 12px"}}>
                <p>{x.category}</p>
                <p>{option.requirement}</p>
                <details><summary>Como conectar</summary><ol>{connectionInstructions(x.id,x.category).map(step=><li key={step}>{step}</li>)}</ol></details>
                {option.href ? <p><a href={option.href} {...(option.href.startsWith("https:") ? {target:"_blank",rel:"noopener noreferrer"} : {})}>{option.action}</a></p> : <p><small>Sem autorização disponível nesta versão.</small></p>}
              </div>
            </details>
          </article>article>
        );})}
      </div>
    </main>
  );
}
