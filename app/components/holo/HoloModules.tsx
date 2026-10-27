"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { chartRange, chartPosition } from "../../../lib/holo/presentation";
import { connectionPresentation } from "../../../lib/holo/validation";
import dynamic from "next/dynamic";
import type { HoloModule, HoloLocalMedia } from "../../../lib/holo/types";
type Of<K extends HoloModule["kind"]> = Extract<HoloModule, { kind: K }>;
export const HoloPlaybackContext = createContext({
  playing: true,
  instant: false,
});
export function HoloTextStream({
  text,
  transient = false,
}: {
  text: string;
  transient?: boolean;
}) {
  const playback = useContext(HoloPlaybackContext);
  const [count, setCount] = useState(0),
    [gone, setGone] = useState(false);
  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = 0;
    setCount(0);
    setGone(false);
  }, [text]);
  useEffect(() => {
    if (
      playback.instant ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      countRef.current = text.length;
      setCount(text.length);
      return;
    }
    if (!playback.playing) return;
    const timer = setInterval(() => {
      countRef.current = Math.min(text.length, countRef.current + 1);
      setCount(countRef.current);
      if (countRef.current >= text.length) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [text, playback.playing, playback.instant]);
  useEffect(() => {
    if (!transient || !playback.playing) return;
    const timer = setTimeout(() => setGone(true), 9000);
    return () => clearTimeout(timer);
  }, [text, transient, playback.playing]);
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
export const HoloWorldMap = dynamic(() => import("./HoloWorldMap"), {
  ssr: false,
  loading: () => <p role="status">Preparando mapa-múndi…</p>,
});
export const HoloMap = dynamic(() => import("./HoloMap"), {
  ssr: false,
  loading: () => <p role="status">Preparando malha cartográfica…</p>,
});
export function HoloTimeline({
  module: m,
  progress,
}: {
  module: Of<"timeline">;
  progress?: number;
}) {
  const [active, setActive] = useState(0);
  const shown =
    progress === undefined
      ? m.events
      : m.events.slice(0, Math.max(1, Math.ceil(progress * m.events.length)));
  return (
    <div className="holo-timeline">
      <ol>
        {shown.map((e, i) => (
          <li key={i} className={i === active ? "is-selected" : ""}>
            <button aria-pressed={active === i} onClick={() => setActive(i)}>
              <time>{e.when}</time>
              <span>{e.label}</span>
            </button>
            {i === active ? (
              <div className="holo-timeline-detail">
                <p>
                  {progress === undefined ? (
                    e.detail
                  ) : (
                    <HoloTextStream text={e.detail} />
                  )}
                </p>
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
export function HoloReport({
  module: m,
  progress,
  point,
}: {
  module: Of<"report">;
  progress?: number;
  point?: number;
}) {
  const items =
    point === undefined
      ? progress === undefined
        ? m.items
        : m.items.slice(0, Math.max(1, Math.ceil(progress * m.items.length)))
      : m.items.slice(point, point + 1);
  return (
    <div className="holo-report">
      <p className="holo-summary">
        {progress === undefined ? (
          m.summary
        ) : (
          <HoloTextStream text={m.summary} />
        )}
      </p>
      <ol>
        {items.map((item, i) => (
          <li key={(point ?? i) + item.label}>
            <span className="holo-item-number">
              {String((point ?? i) + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>
                {progress === undefined ? (
                  item.label
                ) : (
                  <HoloTextStream text={item.label} />
                )}
              </strong>
              {item.detail ? (
                <p>
                  {progress === undefined ? (
                    item.detail
                  ) : (
                    <HoloTextStream text={item.detail} />
                  )}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {progress === undefined && m.body ? (
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
export function HoloMetrics({
  module: m,
  progress = 1,
}: {
  module: Of<"metrics">;
  progress?: number;
}) {
  const { low, high } = chartRange(m.values.map((v) => v.value)),
    pos = (v: number) => chartPosition(v, low, high),
    zero = pos(0);
  const points = m.values.map((v, i) => [
    16 + (i * 268) / Math.max(1, m.values.length - 1),
    116 - pos(v.value) * 96,
  ]);
  return (
    <div className={"holo-metrics style-" + m.style}>
      <p className="holo-caption">{m.unit}</p>
      {m.style === "line" || m.style === "radar" ? (
        <svg
          viewBox="0 0 320 150"
          className="holo-chart"
          role="img"
          aria-label={
            m.title +
            ". " +
            m.values.map((v) => v.label + ": " + v.value).join(", ")
          }
        >
          <path d="M16 10V116H290" className="holo-chart-axis" />
          <path
            d={"M16 " + (116 - zero * 96) + "H290"}
            className="holo-chart-axis"
          />
          {m.style === "line" ? (
            <polyline
              points={points.map((p) => p.join(",")).join(" ")}
              pathLength="1"
              style={{ strokeDasharray: 1, strokeDashoffset: 1 - progress }}
              className="holo-chart-line"
            />
          ) : (
            <polygon
              points={m.values
                .map((v, i) => {
                  const a = (2 * Math.PI * i) / m.values.length - Math.PI / 2,
                    r = 45 * pos(v.value);
                  return [160 + Math.cos(a) * r, 65 + Math.sin(a) * r].join(
                    ",",
                  );
                })
                .join(" ")}
              className="holo-chart-radar"
            />
          )}
          {points
            .filter(
              (_, i) => i % Math.max(1, Math.floor(points.length / 4)) === 0,
            )
            .map((p, i) => (
              <text key={i} x={p[0]} y="137" fill="#83b7ce" fontSize="9">
                {
                  m.values[i * Math.max(1, Math.floor(points.length / 4))]
                    ?.label
                }
              </text>
            ))}
          <text x="292" y="20" fill="#83b7ce" fontSize="9">
            {high.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </text>
          <text x="292" y="116" fill="#83b7ce" fontSize="9">
            {low.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          </text>
        </svg>
      ) : null}
      <dl>
        {m.values
          .slice(
            0,
            progress < 1
              ? Math.max(1, Math.ceil(progress * m.values.length))
              : m.values.length,
          )
          .map((v, i) => (
            <div key={i} className="holo-metric">
              <dt>{v.label}</dt>
              <dd>
                {v.value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
              </dd>
              {m.style === "bars" ? (
                <span className="holo-metric-track" aria-hidden="true">
                  <i
                    style={{
                      width:
                        (Math.abs(v.value) /
                          (Math.max(Math.abs(low), Math.abs(high)) || 1)) *
                          100 +
                        "%",
                      background: v.value < 0 ? "#e9bb72" : undefined,
                    }}
                  />
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
                    strokeDasharray={pos(v.value) * 100 + " 100"}
                  />
                </svg>
              ) : null}
            </div>
          ))}
      </dl>
      <small>
        Valores recebidos, datas e unidades identificados; sem projeção de
        números ausentes.
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
  progress,
  point,
}: {
  progress?: number;
  point?: number;
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
      return m.region === "WORLD" ? (
        <HoloWorldMap module={m} />
      ) : (
        <HoloMap module={m} />
      );
    case "timeline":
      return <HoloTimeline module={m} progress={progress} />;
    case "report":
      return <HoloReport module={m} progress={progress} point={point} />;
    case "media":
      return <HoloMedia module={m} local={local} />;
    case "compare":
      return <HoloCompare module={m} />;
    case "metrics":
      return <HoloMetrics module={m} progress={progress} />;
    case "connections":
      return <HoloConnections module={m} />;
  }
}
