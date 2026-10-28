"use client";
import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import HoloTypewriter from "./HoloTypewriter";
import { HoloPlaybackContext } from "./HoloPlaybackContext";
import { chartRange, chartPosition } from "../../../lib/holo/presentation";
import { connectionPresentation } from "../../../lib/holo/validation";
import dynamic from "next/dynamic";
import type { HoloModule, HoloLocalMedia } from "../../../lib/holo/types";
type Of<K extends HoloModule["kind"]> = Extract<HoloModule, { kind: K }>;
export { HoloPlaybackContext } from "./HoloPlaybackContext";
export const HoloTextStream = HoloTypewriter;
export function HoloPanel({
  id,
  title,
  kind,
  children,
  onClose,
  library = false,
  note,
}: {
  id: string;
  title: string;
  kind: string;
  children: ReactNode;
  onClose: () => void;
  library?: boolean;
  note?: string;
}) {
  const playback = useContext(HoloPlaybackContext);
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
          <span className="holo-module-code">
            {note || "JK / " + kind.toUpperCase()}
          </span>
          <h3 id={id + "-heading"}>
            {playback.automatic ? (
              <HoloTextStream text={title} role="title" />
            ) : (
              title
            )}
          </h3>
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
  loading: () => (
    <p role="status" data-holo-pending>
      Preparando mapa-múndi…
    </p>
  ),
});
export const HoloMap = dynamic(() => import("./HoloMap"), {
  ssr: false,
  loading: () => (
    <p role="status" data-holo-pending>
      Preparando malha cartográfica…
    </p>
  ),
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
  automatic = false,
  view = "combined",
  domain,
}: {
  view?: "chart" | "observation" | "combined" | "categories";
  domain?: { low: number; high: number };
  automatic?: boolean;
  module: Of<"metrics">;
  progress?: number;
}) {
  const { low, high } = domain || chartRange(m.values.map((v) => v.value)),
    pos = (v: number) => chartPosition(v, low, high),
    zero = pos(0);
  const points = m.values.map((v, i) => [
    24 + (i * 238) / Math.max(1, m.values.length - 1),
    132 - pos(v.value) * 104,
  ]);
  return (
    <div
      className={"holo-metrics style-" + m.style}
      data-holo-chart-ready={view === "observation" || progress >= 1}
    >
      {!automatic || view === "chart" || view === "categories" ? (
        <p className="holo-caption">
          {automatic ? (
            <HoloTextStream text={m.unit} role="metadata" />
          ) : (
            m.unit
          )}
        </p>
      ) : null}
      {view !== "observation" &&
      view !== "categories" &&
      (m.style === "line" || m.style === "radar") ? (
        <svg
          viewBox="0 0 340 175"
          className="holo-chart"
          role="img"
          aria-label={
            m.title +
            ". " +
            m.values.map((v) => v.label + ": " + v.value).join(", ")
          }
        >
          <path d="M24 20V132H267" className="holo-chart-axis" />
          <path
            d={"M24 " + (132 - zero * 104) + "H267"}
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
            .map((p, index) => ({ p, index }))
            .filter(
              ({ index }) =>
                index === 0 ||
                index === points.length - 1 ||
                index % Math.max(1, Math.floor(points.length / 4)) === 0,
            )
            .map(({ p, index }) => (
              <text
                key={index}
                x={p[0]}
                y="158"
                textAnchor={index === points.length - 1 ? "end" : "start"}
                fill="#b9d1df"
                fontSize={automatic ? 12 : 10}
              >
                {m.values[index]?.label}
              </text>
            ))}
          <text x="273" y="28" fill="#b9d1df" fontSize={automatic ? 12 : 10}>
            {high.toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
              notation: "compact",
            })}
          </text>
          <text x="273" y="132" fill="#b9d1df" fontSize={automatic ? 12 : 10}>
            {low.toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
              notation: "compact",
            })}
          </text>
        </svg>
      ) : null}
      {automatic ? (
        view === "categories" ? (
          <dl className="holo-metric-categories">
            {m.values.map((v, i) => (
              <div className="holo-metric" key={i}>
                <dt>
                  <HoloTextStream text={v.label} />
                </dt>
                <dd>
                  <HoloTextStream
                    text={v.value.toLocaleString("pt-BR", {
                      maximumFractionDigits: 4,
                    })}
                  />
                </dd>
                <span className="holo-metric-track" aria-hidden="true">
                  <i
                    style={{
                      width:
                        ((progress * Math.abs(v.value)) /
                          (Math.max(Math.abs(low), Math.abs(high)) || 1)) *
                          100 +
                        "%",
                    }}
                  />
                </span>
              </div>
            ))}
          </dl>
        ) : view === "chart" ? (
          <p className="holo-chart-note">
            Faixa observada:{" "}
            {low.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} a{" "}
            {high.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}.<br />
            {m.values.some((v) => v.period) ? "Período" : "Rótulos"}:{" "}
            {m.values[0]?.period || m.values[0]?.label} a{" "}
            {m.values.at(-1)?.period || m.values.at(-1)?.label}.
          </p>
        ) : (
          <div className="holo-metric-focus">
            <span>
              Última observação ·{" "}
              {m.values.at(-1)?.period || m.values.at(-1)?.label}
            </span>
            <strong>
              <HoloTextStream
                text={m.values
                  .at(-1)!
                  .value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}
              />
            </strong>
            <span className="holo-metric-unit">
              <HoloTextStream text={m.unit} role="metadata" />
            </span>
            <small>
              Período da série: {m.values[0]?.period || m.values[0]?.label} a{" "}
              {m.values.at(-1)?.period || m.values.at(-1)?.label}.
            </small>
          </div>
        )
      ) : (
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
                  {v.value.toLocaleString("pt-BR", {
                    maximumFractionDigits: 4,
                  })}
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
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      className="holo-chart-axis"
                    />
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
      )}
      {!automatic ? (
        <small>
          Valores recebidos, datas e unidades identificados; sem projeção de
          números ausentes.
        </small>
      ) : null}
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
