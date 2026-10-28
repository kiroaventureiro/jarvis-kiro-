"use client";
import Link from "next/link";
import type { HoloLocalMedia } from "../../../lib/holo/types";
import type { DemonstrationStep } from "../../../lib/holo/presentation";
import { connectionPresentation } from "../../../lib/holo/validation";
import {
  HoloTextStream,
  HoloMap,
  HoloWorldMap,
  HoloMetrics,
  HoloMedia,
  connectionLabels,
} from "./HoloModules";
export default function HoloAutomaticContent({
  step,
  local,
  progress,
}: {
  step: DemonstrationStep;
  local: HoloLocalMedia[];
  progress: number;
}) {
  const m = step.content;
  switch (m.kind) {
    case "report":
      return (
        <div className="holo-auto-content holo-report">
          <p className="holo-auto-message">
            <HoloTextStream text={m.summary} />
          </p>
          {m.items.map((p, i) => (
            <p key={i}>
              <HoloTextStream text={p.label + ". " + p.detail} />
            </p>
          ))}
          {m.href ? (
            <Link className="holo-action-link" href={m.href}>
              Abrir relatório e plano →
            </Link>
          ) : null}
        </div>
      );
    case "timeline":
      return (
        <div className="holo-auto-content holo-timeline-auto">
          {m.events.map((e, i) => (
            <article key={i}>
              <p className="holo-period">
                <HoloTextStream text={e.when} role="subtitle" />
              </p>
              <p className="holo-auto-message">
                <HoloTextStream text={e.detail} />
              </p>
              {e.href ? (
                <a href={e.href} target="_blank" rel="noreferrer">
                  Consultar fonte ↗
                </a>
              ) : null}
            </article>
          ))}
        </div>
      );
    case "text":
      return (
        <div className="holo-auto-content">
          <p className="holo-auto-message">
            <HoloTextStream text={m.text} />
          </p>
        </div>
      );
    case "compare":
      return (
        <div className="holo-auto-content holo-compare">
          {m.columns.map((c, i) => (
            <section key={i}>
              <h4>
                <HoloTextStream text={c.label} role="subtitle" />
              </h4>
              {c.points.map((p, n) => (
                <p key={n}>
                  <HoloTextStream text={p} delay={300} />
                </p>
              ))}
            </section>
          ))}
        </div>
      );
    case "connections":
      return (
        <div className="holo-auto-content holo-connections">
          {m.items.map((c) => {
            const view = connectionPresentation(c.state, c.checkedAt);
            return (
              <article key={c.id} data-connection-state={view.state}>
                <h4>
                  <HoloTextStream text={c.label} role="subtitle" />
                </h4>
                <p className="holo-status-label">
                  {view.stale
                    ? "Revalidação necessária"
                    : connectionLabels[c.state]}
                </p>
                <p className="holo-auto-message">
                  <HoloTextStream text={c.detail} />
                </p>
                {c.checkedAt ? (
                  <time>
                    Verificado em{" "}
                    {new Date(c.checkedAt).toLocaleString("pt-BR")}
                  </time>
                ) : null}
              </article>
            );
          })}
          <Link href="/conexoes">Administrar na Central →</Link>
        </div>
      );
    case "metrics":
      return (
        <HoloMetrics
          module={m}
          progress={progress}
          automatic
          view={step.metricView}
          domain={step.metricDomain}
        />
      );
    case "map":
      return m.region === "WORLD" ? (
        <HoloWorldMap module={m} automatic />
      ) : (
        <HoloMap module={m} automatic />
      );
    case "media":
      return (
        <div className="holo-auto-content">
          <HoloMedia module={m} local={local} />
          {m.items.map((i) => (
            <p key={i.id}>
              <HoloTextStream text={i.caption || i.label} />
            </p>
          ))}
        </div>
      );
  }
}
