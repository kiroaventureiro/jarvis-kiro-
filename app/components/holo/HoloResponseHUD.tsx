"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useHoloSession } from "./HoloSession";
import { HoloPanel, HoloModuleView, HoloTextStream } from "./HoloModules";
import { exportScene, visibleModules } from "../../../lib/holo/validation";
import type { HoloScene, HoloLocalMedia } from "../../../lib/holo/types";
export function downloadHoloScene(scene: HoloScene) {
  const url = URL.createObjectURL(
    new Blob([exportScene(scene)], { type: "application/json;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "jk-" + scene.id + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function ScenePanels({
  scene,
  local = [],
  library = false,
}: {
  scene: HoloScene;
  local?: HoloLocalMedia[];
  library?: boolean;
}) {
  const [active, setActive] = useState(
      scene.modules.slice(0, 3).map((m) => m.id),
    ),
    [compact, setCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 850px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const shown = visibleModules(scene, active, compact && !library);
  function toggle(id: string) {
    setActive((ids) =>
      compact && !library
        ? [id]
        : ids.includes(id)
          ? ids.filter((x) => x !== id)
          : [...ids.slice(-2), id],
    );
  }
  return (
    <>
      <div className="holo-module-tabs" aria-label="Módulos deste resultado">
        {scene.modules.map((m) => (
          <button
            key={m.id}
            className={shown.some((x) => x.id === m.id) ? "is-active" : ""}
            aria-pressed={shown.some((x) => x.id === m.id)}
            onClick={() => toggle(m.id)}
          >
            {m.title}
          </button>
        ))}
      </div>
      <div className="holo-panel-grid">
        {shown.map((m) => (
          <HoloPanel
            key={m.id}
            id={scene.id + "-" + m.id}
            title={m.title}
            kind={m.kind}
            library={library}
            onClose={() => setActive((ids) => ids.filter((id) => id !== m.id))}
          >
            <HoloModuleView module={m} local={local} />
          </HoloPanel>
        ))}
      </div>
      {!shown.length ? (
        <button
          className="holo-restore"
          onClick={() => setActive(scene.modules.slice(0, 3).map((m) => m.id))}
        >
          Reabrir módulos deste resultado
        </button>
      ) : null}
    </>
  );
}
export default function HoloResponseHUD({
  local = [],
}: {
  local?: HoloLocalMedia[];
}) {
  const { current: scene, close, media } = useHoloSession();
  if (!scene) return null;
  return (
    <aside
      className="holo-response-layer"
      aria-label="Resultados holográficos"
      data-scene-mode={scene.mode}
    >
      <header className="holo-scene-heading">
        <div>
          <span className="holo-eyebrow">PROJEÇÃO CONTEXTUAL / JK</span>
          <h2>
            <HoloTextStream text={scene.title} />
          </h2>
          <p>
            {scene.source.label}
            {scene.source.href ? (
              <a
                href={scene.source.href}
                target={
                  scene.source.href.startsWith("https:") ? "_blank" : undefined
                }
                rel="noreferrer"
              >
                {" "}
                · fonte ↗
              </a>
            ) : null}
          </p>
        </div>
        <div className="holo-scene-actions">
          <button
            onClick={() => downloadHoloScene(scene)}
            aria-label="Exportar resultado holográfico"
          >
            ↓
          </button>
          <Link href="/resultados" aria-label="Abrir resultados desta sessão">
            ▦
          </Link>
          <button onClick={close} aria-label="Fechar resultados holográficos">
            ×
          </button>
        </div>
      </header>
      <ScenePanels key={scene.id} scene={scene} local={[...media, ...local]} />
    </aside>
  );
}
