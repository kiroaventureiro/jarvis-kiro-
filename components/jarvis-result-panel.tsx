"use client";
import type { JarvisUnifiedResult } from "../lib/orchestration/unified-result";
import { jarvisResultView } from "../lib/orchestration/result-view";

/** Reusable result panel for the Jarvis chat; the host must pass trusted API data. */
export function JarvisResultPanel({ result }: { result: JarvisUnifiedResult }) {
  const view = jarvisResultView(result);
  return (
    <section aria-label={`Resultado ${view.title}`} data-result-status={view.status}>
      <header><strong>{view.title}</strong> <span>{view.statusLabel}</span></header>
      {view.messages.map((message, index) => <p key={index}>{message}</p>)}
      {view.artifacts.map((artifact, index) => (
        <div key={index}>
          <span>{artifact.name}</span>
          {artifact.previewUrl ? <a href={artifact.previewUrl} target="_blank" rel="noopener noreferrer">Abrir arquivo</a> : <span>Prévia indisponível</span>}
        </div>
      ))}
    </section>
  );
}
