"use client";
import type { FilePhase, LocalAttachment } from "./useFileWorkspace";
const phaseLabels: Record<FilePhase, string> = {
  idle: "Aguardando orientação",
  sending: "Enviando arquivos",
  transcribing: "Reconhecendo sua orientação",
  analyzing: "Analisando arquivos",
  responding: "Construindo resposta",
  done: "Análise concluída",
  error: "Análise não concluída",
};
export default function AttachmentHUD({
  files,
  phase,
  notice,
  busy,
  recording,
  onRemove,
  onCancel,
}: {
  files: LocalAttachment[];
  phase: FilePhase;
  notice: string;
  busy: boolean;
  recording: boolean;
  onRemove: (id: string) => void;
  onCancel: () => void;
}) {
  if (!files.length && !notice) return null;
  return (
    <section
      className={"attachment-hud glass " + (busy ? "is-analyzing" : "")}
      aria-label="Arquivos da análise"
      aria-busy={busy}
    >
      <div className="hud-heading">
        <span>{recording ? "ORIENTAÇÃO POR VOZ" : phaseLabels[phase]}</span>
        <span>{files.length}/8</span>
      </div>
      <div className="attachment-list">
        {files.map((item) => (
          <article className="attachment-card" key={item.id}>
            {item.preview ? (
              <img src={item.preview} alt={"Prévia de " + item.file.name} />
            ) : (
              <span className="file-glyph" aria-hidden="true">
                ◇
              </span>
            )}
            <div>
              <p title={item.file.name}>{item.file.name}</p>
              <span>{Math.max(1, Math.round(item.file.size / 1024))} KB</span>
            </div>
            <button
              type="button"
              className="subtle-button"
              disabled={busy || recording}
              onClick={() => onRemove(item.id)}
              aria-label={"Remover " + item.file.name}
            >
              ×
            </button>
          </article>
        ))}
      </div>
      {notice ? (
        <p
          className={
            "attachment-notice " + (phase === "error" ? "file-error" : "")
          }
          role={phase === "error" ? "alert" : "status"}
        >
          {notice}
        </p>
      ) : null}
      {files.length ? (
        <div className="attachment-foot">
          <span>Até 3 MB no total · envio ao pedir a análise</span>
          {busy ? (
            <button type="button" className="subtle-button" onClick={onCancel}>
              Interromper análise
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
