"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { connectionPresentation } from "../../../lib/holo/validation";
import dynamic from "next/dynamic";
import type { HoloModule, HoloLocalMedia } from "../../../lib/holo/types";
type Of<K extends HoloModule["kind"]> = Extract<HoloModule, { kind: K }>;
export function HoloTextStream({
  text,
  transient = false,
}: {
  text: string;
  transient?: boolean;
}) {
  const [count, setCount] = useState(0),
    [gone, setGone] = useState(false);
  useEffect(() => {
    setGone(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const timer = setInterval(
      () =>
        setCount((n) => {
          if (n >= text.length) clearInterval(timer);
          return Math.min(text.length, n + 2);
        }),
      28,
    );
    const fade = transient ? setTimeout(() => setGone(true), 9000) : null;
    return () => {
      clearInterval(timer);
      if (fade) clearTimeout(fade);
    };
  }, [text, transient]);
  return (
    <span
      className={"holo-text-stream " + (gone ? "is-faded" : "")}
      aria-label={text}
    >
      <span aria-hidden="true">
        {text.slice(0, count)}
        <i className={count < text.length ? "holo-caret" : ""} />
      </span>
    </span>
  );
}
export function HoloPanel({
  id,
  title,
  kind,
  children,
  onClose,
  library = false,
}: {
  id: string;
  title: string;
  kind: string;
  children: ReactNode;
  onClose: () => void;
  library?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <section
      className={"holo-panel " + (expanded ? "holo-expanded" : "")}
      data-module={kind}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === "Escape" && expanded) {
          e.stopPropagation();
          setExpanded(false);
          button.current?.focus();
        }
      }}
    >
      <header className="holo-panel-heading">
        <div>
          <span className="holo-module-code">JK / {kind.toUpperCase()}</span>
          <h3 id={id + "-heading"}>{title}</h3>
        </div>
        <div className="holo-panel-controls">
          <button
            ref={button}
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={(expanded ? "Recolher " : "Expandir ") + title}
          >
            {expanded ? "↙" : "⛶"}
          </button>
          {!library ? (
            <button
              type="button"
              onClick={onClose}
              aria-label={"Fechar " + title}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>
      <div className="holo-panel-body">{children}</div>
      <span className="holo-panel-corner" aria-hidden="true" />
    </section>
  );
}
export const HoloMap = dynamic(() => import("./HoloMap"), {
  ssr: false,
  loading: () => <p role="status">Preparando malha cartográfica…</p>,
});
export function HoloTimeline({ module: m }: { module: Of<"timeline"> }) {
  const [active, setActive] = useState(0);
  return (
    <div className="holo-timeline">
      <ol>
        {m.events.map((e, i) => (
          <li key={i} className={i === active ? "is-selected" : ""}>
            <button aria-pressed={active === i} onClick={() => setActive(i)}>
              <time>{e.when}</time>
              <span>{e.label}</span>
            </button>
            {i === active ? (
              <div className="holo-timeline-detail">
                <p>{e.detail}</p>
                {e.href ? (
                  <a href={e.href} target="_blank" rel="noreferrer">
                    Consultar fonte ↗
                  </a>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
export function HoloReport({ module: m }: { module: Of<"report"> }) {
  return (
    <div className="holo-report">
      <p className="holo-summary">{m.summary}</p>
      <ol>
        {m.items.map((item, i) => (
          <li key={i}>
            <span className="holo-item-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{item.label}</strong>
              {item.detail ? <p>{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      {m.body ? (
        <details>
          <summary>Texto completo do resultado</summary>
          <p className="holo-report-full">{m.body}</p>
        </details>
      ) : null}
      {m.href ? (
        <Link className="holo-action-link" href={m.href}>
          Abrir relatório e plano →
        </Link>
      ) : null}
    </div>
  );
}
function MediaItem({
  item,
  local,
}: {
  item: Of<"media">["items"][number];
  local: HoloLocalMedia[];
}) {
  const localFile = local.find((f) => f.id === item.localId),
    [loaded, setLoaded] = useState(false),
    [failed, setFailed] = useState(false);
  const url = localFile?.url || (loaded ? item.url : undefined);
  return (
    <figure className="holo-media-item">
      <div className="holo-media-frame">
        {failed ? (
          <p role="status">Não foi possível exibir esta mídia.</p>
        ) : url ? (
          item.type === "video" ? (
            <video
              src={url}
              controls
              preload="metadata"
              playsInline
              onError={() => setFailed(true)}
              aria-label={item.label}
            />
          ) : (
            <img
              src={url}
              alt={item.label}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
            />
          )
        ) : item.url ? (
          <button onClick={() => setLoaded(true)}>
            Carregar {item.type === "video" ? "vídeo" : "imagem"} externo
          </button>
        ) : (
          <p>
            Arquivo disponível somente enquanto estiver anexado nesta sessão.
          </p>
        )}
      </div>
      <figcaption>
        <strong>{item.label}</strong>
        {item.caption ? <p>{item.caption}</p> : null}
        {item.url && !loaded ? (
          <small>
            O carregamento acessará {new URL(item.url).hostname}. Nenhuma mídia
            é gerada por este controle.
          </small>
        ) : null}
      </figcaption>
    </figure>
  );
}
export function HoloMedia({
  module: m,
  local = [],
}: {
  module: Of<"media">;
  local?: HoloLocalMedia[];
}) {
  return (
    <div className="holo-media">
      {m.items.map((item, i) => (
        <MediaItem key={item.id + ":" + i} item={item} local={local} />
      ))}
    </div>
  );
}
export function HoloCompare({ module: m }: { module: Of<"compare"> }) {
  return (
    <div className="holo-compare">
      {m.columns.map((col, i) => (
        <section key={i}>
          <span className="holo-compare-letter">{i ? "B" : "A"}</span>
          <h4>{col.label}</h4>
          <ul>
            {col.points.map((p, n) => (
              <li key={n}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
export function HoloMetrics({ module: m }: { module: Of<"metrics"> }) {
  const maximum = Math.max(1, ...m.values.map((v) => v.value));
  const pct = (v: number) => (100 * v) / maximum;
  const positions = m.values.map((v, i) => {
    const a = (2 * Math.PI * i) / m.values.length - Math.PI / 2,
      r = (42 * v.value) / maximum;
    return [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  });
  return (
    <div className={"holo-metrics style-" + m.style}>
      <p className="holo-caption">{m.unit}</p>
      {m.style === "line" ? (
        <svg
          viewBox="0 0 240 95"
          className="holo-chart"
          role="img"
          aria-label={
            m.title +
            ". " +
            m.values.map((v) => v.label + ": " + v.value).join(", ")
          }
        >
          <path d="M10 10V80H230" className="holo-chart-axis" />
          <polyline
            points={m.values
              .map(
                (v, i) =>
                  10 +
                  (i * 220) / Math.max(1, m.values.length - 1) +
                  "," +
                  (80 - (65 * v.value) / maximum),
              )
              .join(" ")}
            className="holo-chart-line"
          />
        </svg>
      ) : m.style === "radar" ? (
        <svg
          viewBox="0 0 100 100"
          className="holo-chart"
          role="img"
          aria-label={m.title + ". Escala relativa ao maior valor informado."}
        >
          <circle cx="50" cy="50" r="42" className="holo-chart-axis" />
          <circle cx="50" cy="50" r="21" className="holo-chart-axis" />
          <polygon
            points={positions.map((p) => p.join(",")).join(" ")}
            className="holo-chart-radar"
          />
        </svg>
      ) : null}
      <dl>
        {m.values.map((v, i) => (
          <div key={i} className="holo-metric">
            <dt>{v.label}</dt>
            <dd>{v.value.toLocaleString("pt-BR")}</dd>
            {m.style === "bars" ? (
              <span className="holo-metric-track" aria-hidden="true">
                <i style={{ width: pct(v.value) + "%" }} />
              </span>
            ) : m.style === "rings" ? (
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="16" className="holo-chart-axis" />
                <circle
                  cx="20"
                  cy="20"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  pathLength="100"
                  strokeDasharray={pct(v.value) + " 100"}
                />
              </svg>
            ) : null}
          </div>
        ))}
      </dl>
      <small>
        Escala relativa aos valores recebidos. Sem estimativas automáticas.
      </small>
    </div>
  );
}
export const connectionLabels = {
  not_configured: "Não configurado",
  credentials_configured: "Credenciais configuradas",
  connection_validated: "Conexão validada",
  operational_authorized: "Operacional e autorizado",
  temporarily_unavailable: "Temporariamente indisponível",
  not_consulted: "Não consultado",
};
export function HoloConnections({ module: m }: { module: Of<"connections"> }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="holo-connections">
      <ul>
        {m.items.map((c) => {
          const view = connectionPresentation(c.state, c.checkedAt, now);
          return (
            <li key={c.id} data-connection-state={view.state}>
              <span className="holo-connection-light" />
              <div>
                <strong>{c.label}</strong>
                <span>
                  {view.stale
                    ? "Revalidação necessária"
                    : connectionLabels[c.state]}
                </span>
                {c.checkedAt ? (
                  <time>{new Date(c.checkedAt).toLocaleString("pt-BR")}</time>
                ) : null}
                <details>
                  <summary>Escopo e evidência</summary>
                  <p>{c.detail}</p>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
      <Link href="/conexoes">Administrar na Central →</Link>
    </div>
  );
}
export function HoloModuleView({
  module: m,
  local = [],
}: {
  module: HoloModule;
  local?: HoloLocalMedia[];
}) {
  switch (m.kind) {
    case "text":
      return (
        <div>
          <HoloTextStream text={m.text} />
          <div className="holo-tags">
            {m.tags.map((tag, i) => (
              <span key={i}>{tag}</span>
            ))}
          </div>
        </div>
      );
    case "map":
      return <HoloMap module={m} />;
    case "timeline":
      return <HoloTimeline module={m} />;
    case "report":
      return <HoloReport module={m} />;
    case "media":
      return <HoloMedia module={m} local={local} />;
    case "compare":
      return <HoloCompare module={m} />;
    case "metrics":
      return <HoloMetrics module={m} />;
    case "connections":
      return <HoloConnections module={m} />;
  }
}
