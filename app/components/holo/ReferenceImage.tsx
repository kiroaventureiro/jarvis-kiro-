"use client";
import { useEffect, useState, useRef } from "react";
import type { CommonsImage } from "../../../lib/research/commons";
import { commonsUpload } from "../../../lib/research/commons";
const names = {
  photograph: "Fotografia",
  illustration: "Ilustração",
  reproduction: "Reprodução de obra ou documento",
  reference: "Imagem de referência · tipo não confirmado",
};
export default function ReferenceImage({ title }: { title: string }) {
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [image, setImage] = useState<CommonsImage | null>(null),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setImage(null);
    setError("");
    setReady(false);
    const timer = setTimeout(() => {
      if (active) {
        controller.abort();
        setError(
          "O carregamento da referência demorou demais. Consulte a fonte ou tente novamente.",
        );
      }
    }, 18000);
    loadTimer.current = timer;
    void fetch("/api/director/images?title=" + encodeURIComponent(title), {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (
          !r.ok ||
          !commonsUpload(d.url) ||
          !d.author ||
          !d.license ||
          !/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(d.sourceHref)
        )
          throw Error(d.error || "Referência não verificada.");
        if (active) setImage(d);
      })
      .catch((e) => {
        if (active && !controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Imagem indisponível.");
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [title]);
  return (
    <figure
      className="holo-reference-image"
      data-holo-pending={!error && !ready ? true : undefined}
      data-reference-state={error ? "error" : ready ? "ready" : "loading"}
    >
      {error ? (
        <p role="status">{error} Nenhuma imagem substituta foi criada.</p>
      ) : image ? (
        <img
          src={image.url}
          alt={title.replace(/^File:/, "")}
          referrerPolicy="no-referrer"
          onLoad={() => {
            if (loadTimer.current) clearTimeout(loadTimer.current);
            setReady(true);
          }}
          onError={() =>
            setError(
              "A fonte retornou um arquivo que o navegador não conseguiu exibir.",
            )
          }
        />
      ) : (
        <p role="status">Verificando arquivo, autoria e licença…</p>
      )}
      {image ? (
        <figcaption>
          <span>{names[image.nature] || names.reference}</span>
          <details>
            <summary>Crédito e referência</summary>
            <p>
              {image.author} · {image.license}
            </p>
            <a href={image.sourceHref} target="_blank" rel="noreferrer">
              Arquivo e autoria ↗
            </a>
            {" · "}
            <a href={image.licenseHref} target="_blank" rel="noreferrer">
              Licença ↗
            </a>
            <small>
              Verificado em {new Date(image.checkedAt).toLocaleString("pt-BR")}.
              O JK não gerou nem alterou o arquivo da fonte.
            </small>
          </details>
        </figcaption>
      ) : null}
    </figure>
  );
}
