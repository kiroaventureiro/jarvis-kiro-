"use client";
import { useState } from "react";
import Link from "next/link";
import { useHoloSession } from "../components/holo/HoloSession";
import {
  ScenePanels,
  downloadHoloScene,
} from "../components/holo/HoloResponseHUD";
export default function ResultsPage() {
  const session = useHoloSession(),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState("");
  const scenes = session.scenes.filter(
      (s) => filter === "all" || s.modules.some((m) => m.kind === filter),
    ),
    scene = scenes.find((s) => s.id === selected) || scenes[0];
  return (
    <main className="holo-library">
      <Link href="/">← Voltar ao núcleo JK</Link>
      <p className="holo-eyebrow">MEMÓRIA VISUAL / SESSÃO ATUAL</p>
      <h1>Resultados projetados</h1>
      <p>
        Até seis resultados mantidos somente na memória desta página e durante a
        navegação. Recarregar ou fechar apaga esta coleção. As prévias dos resultados ficam apenas nesta sessão e são liberadas ao limpar a coleção.
      </p>
      <div className="holo-library-toolbar">
        <label>
          Mostrar
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos os resultados</option>
            <option value="report">Relatórios e diagnósticos</option>
            <option value="media">Mídias</option>
            <option value="map">Mapas</option>
            <option value="timeline">Linhas do tempo</option>
            <option value="compare">Comparações</option>
            <option value="connections">Conexões</option>
          </select>
        </label>
        <button disabled={!session.scenes.length} onClick={session.clear}>
          Limpar memória visual
        </button>
      </div>
      <div className="holo-library-layout">
        <nav aria-label="Histórico visual desta sessão">
          {scenes.map((s) => (
            <button
              key={s.id}
              aria-current={scene?.id === s.id ? "true" : undefined}
              onClick={() => setSelected(s.id)}
            >
              <strong>{s.title}</strong>
              <small>
                {new Date(s.createdAt).toLocaleTimeString("pt-BR")} ·{" "}
                {s.source.kind}
              </small>
            </button>
          ))}
        </nav>
        {scene ? (
          <section className="holo-library-scene">
            <header>
              <h2>{scene.title}</h2>
              <p>{scene.source.label}</p>
              <button
                onClick={() => {
                  session.select(scene.id);
                }}
              >
                Selecionar para a home
              </button>
              <button onClick={() => downloadHoloScene(scene)}>
                Exportar resultado
              </button>
            </header>
            <ScenePanels
              key={scene.id}
              scene={scene}
              library
              local={session.media}
            />
          </section>
        ) : (
          <div className="glass holo-library-empty">
            <h2>Nenhum resultado nesta sessão</h2>
            <p>
              Peça uma explicação, analise um arquivo ou consulte um projeto
              autorizado. Os módulos aparecerão conforme houver conteúdo.
            </p>
            <Link href="/">Conversar com o JK →</Link>
          </div>
        )}
      </div>
      <footer>
        <Link href="/conexoes">Central de Conexões</Link>
        <Link href="/projetos">Projetos KIRO</Link>
        <Link href="/configuracoes">Voz e configurações</Link>
      </footer>
    </main>
  );
}
