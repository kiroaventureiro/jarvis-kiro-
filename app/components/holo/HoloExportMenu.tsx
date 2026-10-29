"use client";
import { useEffect, useRef, useState } from "react";
import type { HoloScene } from "../../../lib/holo/types";
import { useHoloSession } from "./HoloSession";
import { exportScene } from "../../../lib/holo/validation";
export default function HoloExportMenu({ scene }: { scene: HoloScene }) {
  const { exportRequest } = useHoloSession();
  const [prepared, setPrepared] = useState<{
    blob: Blob;
    format: string;
  } | null>(null);
  const handled = useRef("");
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(""),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [scene.id],
  );
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("jk-holo-export-hold", {
        detail: { sceneId: scene.id, hold: open || !!busy },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent("jk-holo-export-hold", {
          detail: { sceneId: scene.id, hold: false },
        }),
      );
    };
  }, [open, busy, scene.id]);
  useEffect(() => {
    if (
      exportRequest?.sceneId !== scene.id ||
      handled.current === exportRequest.id
    )
      return;
    handled.current = exportRequest.id;
    setOpen(true);
    void run(exportRequest.format, true);
  }, [exportRequest?.id, scene.id]);
  useEffect(() => {
    setPrepared(null);
  }, [scene.id]);
  function download(blob: Blob, format: string) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "jk-" + scene.id + "." + format;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function run(
    format: "pdf" | "png" | "webm" | "json",
    prepareOnly = false,
  ) {
    if (controller.current) return;
    const abort = new AbortController(),
      epoch = ++generation.current;
    controller.current = abort;
    setBusy(format);
    setError("");
    setProgress(0);
    try {
      let blob: Blob;
      if (format === "json")
        blob = new Blob([exportScene(scene)], { type: "application/json" });
      else {
        const render = await import("../../../lib/holo/export-renderer");
        blob =
          format === "pdf"
            ? await render.pdfExport(scene, abort.signal)
            : format === "png"
              ? await render.imageExport(scene, abort.signal)
              : await render.videoExport(scene, abort.signal, setProgress);
      }
      if (abort.signal.aborted || epoch !== generation.current) return;
      if (prepareOnly) {
        setPrepared({ blob, format });
      } else {
        download(blob, format);
        setOpen(false);
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Não foi possível exportar.");
    } finally {
      if (epoch === generation.current) {
        setBusy("");
        controller.current = null;
      }
    }
  }
  return (
    <div className="holo-export-menu">
      <button
        aria-label="Exportar resultado holográfico"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ↓ Exportar
      </button>
      {open ? (
        <div
          className="glass holo-export-options"
          role="group"
          aria-label="Formatos de exportação"
        >
          <button disabled={!!busy} onClick={() => run("pdf")}>
            PDF · relatório completo
          </button>
          <button disabled={!!busy} onClick={() => run("png")}>
            PNG · demonstração principal
          </button>
          <button disabled={!!busy} onClick={() => run("webm")}>
            Vídeo WebM · sem áudio
          </button>
          <button disabled={!!busy} onClick={() => run("json")}>
            JSON · dados estruturados
          </button>
          <small>
            Gerado neste navegador, sem serviço pago. O vídeo reproduz os
            quadros; não é vídeo generativo. Mídias externas permanecem como
            referências.
          </small>
          {prepared && !busy ? (
            <div className="holo-prepared-export">
              <p role="status">
                {prepared.format.toUpperCase()} preparado neste navegador.
                Nenhum arquivo foi enviado ou salvo em serviço externo.
              </p>
              <button onClick={() => download(prepared.blob, prepared.format)}>
                Baixar {prepared.format.toUpperCase()}
              </button>
            </div>
          ) : null}
          {busy ? (
            <>
              <p role="status">
                {busy === "webm"
                  ? "Renderizando vídeo " + Math.round(progress * 100) + "%"
                  : "Preparando " + busy.toUpperCase() + "…"}
              </p>
              <button onClick={() => controller.current?.abort()}>
                Cancelar exportação
              </button>
            </>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
