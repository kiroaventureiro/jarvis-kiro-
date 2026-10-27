"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AbacusStatus from "../components/AbacusStatus";
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
  );
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
      <AbacusStatus />
      <p>
        Explore plataformas de IA, redes sociais e ferramentas para a KIRO.
        Catálogo de possibilidades: a presença aqui não significa que a conta
        esteja conectada ou que exista integração oficial. Credenciais não são
        solicitadas nesta fase.
      </p>
      <p>
        <strong>
          {items.length} opções catalogadas ·{" "}
          {items.filter((x) => x.status === "connected").length} conectadas
          neste catálogo
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
        {shown.map((x) => (
          <article key={x.id} className="glass card" style={{ padding: 18 }}>
            <h2 style={{ fontSize: "1.1rem" }}>{x.name}</h2>
            <p>{x.category}</p>
            <p>
              <small>Aguardando conector e autorização</small>
            </p>
            <button
              type="button"
              disabled
              title="Integração ainda não implementada; nenhuma credencial pode ser enviada"
            >
              Conectar em breve
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
