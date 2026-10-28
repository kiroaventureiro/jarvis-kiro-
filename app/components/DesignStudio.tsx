"use client";
import { useEffect, useRef, useState } from "react";
import {
  designFromBrief,
  extractDesign,
  designFiles,
  normalizeDesign,
  previewDocument,
  wireframe,
  type DesignSpec,
} from "../../lib/design/core";
import { designZip } from "../../lib/design/archive";
import styles from "./DesignStudio.module.css";
export default function DesignStudio() {
  const [mode, setMode] = useState("brief"),
    [brief, setBrief] = useState(""),
    [html, setHtml] = useState(""),
    [css, setCss] = useState(""),
    [image, setImage] = useState(""),
    [consent, setConsent] = useState(false),
    [spec, setSpec] = useState<DesignSpec | null>(null),
    [draft, setDraft] = useState(""),
    [extraction, setExtraction] = useState<
      ReturnType<typeof extractDesign> | undefined
    >(),
    [approved, setApproved] = useState(false),
    [catalog, setCatalog] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null),
    generation = useRef(0),
    urls = useRef(new Set<string>());
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  function reset() {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
    setSpec(null);
    setDraft("");
    setExtraction(undefined);
    setApproved(false);
    setCatalog(false);
    setError("");
  }
  async function receive(file: File) {
    reset();
    setConsent(false);
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1400000
    ) {
      setError("Envie PNG, JPG ou WebP de até 1,4 MB.");
      return;
    }
    const run = generation.current;
    const reader = new FileReader();
    reader.onload = () => {
      if (run !== generation.current) return;
      setImage(String(reader.result));
      setMode("image");
    };
    reader.onerror = () => {
      if (run === generation.current)
        setError("Não foi possível ler a imagem.");
    };
    reader.readAsDataURL(file);
  }
  async function prepare() {
    reset();
    const run = generation.current;
    try {
      let next: DesignSpec;
      if (mode === "image") {
        if (!image || !consent)
          throw Error("Selecione a imagem e autorize seu envio à Abacus.");
        const ac = new AbortController();
        controller.current = ac;
        setBusy(true);
        const r = await fetch("/api/director/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ image, approved: true }),
          signal: ac.signal,
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Análise indisponível.");
        next = normalizeDesign(data.spec, "image");
      } else if (mode === "extract") {
        const found = extractDesign(html, css);
        next = found.spec;
        setExtraction(found);
      } else {
        if (!brief.trim()) throw Error("Descreva a interface.");
        next = designFromBrief(brief);
      }
      if (run !== generation.current) return;
      setSpec(next);
      setDraft(JSON.stringify(next, null, 2));
    } catch (e) {
      if (run === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível preparar a estrutura.",
        );
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }
  function applyDraft() {
    try {
      const next = normalizeDesign(JSON.parse(draft), spec?.source);
      setSpec(next);
      setDraft(JSON.stringify(next, null, 2));
      setApproved(false);
      setCatalog(false);
      setError("");
    } catch {
      setError("Estrutura inválida. Revise o JSON e as regiões.");
    }
  }
  const files = spec && approved ? designFiles(spec, extraction) : null;
  function download(name: string, data: string | Uint8Array) {
    const blob =
      typeof data === "string"
        ? new Blob([data], { type: "text/plain;charset=utf-8" })
        : new Blob([data as Uint8Array<ArrayBuffer>], {
            type: "application/zip",
          });
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
    }, 1000);
  }
  return (
    <div
      className={styles.studio}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) void receive(f);
      }}
    >
      <p>
        Transforme uma referência em uma proposta estática, revise a estrutura e
        baixe os arquivos. Os rascunhos ficam somente nesta página até você
        baixar; recarregar descarta o trabalho.
      </p>
      <div role="group" aria-label="Tipo de criação" className={styles.actions}>
        {[
          ["brief", "Estrutura por descrição"],
          ["image", "Imagem para interface"],
          ["extract", "Extrair de HTML/CSS"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={mode === id}
            onClick={() => {
              reset();
              setMode(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "brief" ? (
        <label>
          Descreva sua interface
          <textarea
            maxLength={4000}
            value={brief}
            onChange={(e) => {
              reset();
              setBrief(e.target.value);
            }}
            placeholder={"Nome do projeto\nApresentação\nServiços\nContato"}
          />
          <small>
            Use uma linha para o nome e as seguintes para as regiões. A
            estrutura inicial é local e editável.
          </small>
        </label>
      ) : mode === "image" ? (
        <section>
          <h2>Referência visual</h2>
          <p>
            Solte a imagem em qualquer parte desta área ou selecione um arquivo.
            A conversão é uma aproximação editável, sem prometer reprodução
            idêntica.
          </p>
          <label>
            Imagem de referência
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                if (e.target.files?.[0]) void receive(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
          {image ? (
            <img
              className={styles.reference}
              src={image}
              alt="Referência fornecida para criação"
            />
          ) : null}
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Autorizo enviar esta imagem à API Abacus para uma análise visual,
            sujeita aos limites e custos já autorizados no servidor.
          </label>
        </section>
      ) : (
        <section>
          <h2>Arquivos de origem</h2>
          <p>
            Cole o HTML e CSS. A extração identifica cabeçalhos, cores,
            variáveis e seletores sem executar o código. Não preserva
            automaticamente animações ou aplicativos React.
          </p>
          <label>
            HTML de origem
            <textarea
              maxLength={250000}
              value={html}
              onChange={(e) => {
                reset();
                setHtml(e.target.value);
              }}
            />
          </label>
          <label>
            CSS de origem
            <textarea
              maxLength={250000}
              value={css}
              onChange={(e) => {
                reset();
                setCss(e.target.value);
              }}
            />
          </label>
        </section>
      )}
      <div className={styles.actions}>
        <button
          disabled={
            busy ||
            (mode === "image" && (!image || !consent)) ||
            (mode === "extract" && !html.trim())
          }
          onClick={() => void prepare()}
        >
          {busy ? "Analisando…" : "Preparar estrutura"}
        </button>
        {busy ? <button onClick={reset}>Cancelar análise</button> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {spec ? (
        <section>
          <h2>1. Revise a estrutura</h2>
          <pre className={styles.wire}>{wireframe(spec)}</pre>
          <details>
            <summary>Editar conteúdo e fundamentos</summary>
            <label>
              Estrutura JSON
              <textarea
                className={styles.code}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setApproved(false);
                  setCatalog(false);
                }}
              />
            </label>
            <button onClick={applyDraft}>Aplicar edição</button>
          </details>
          {extraction ? (
            <>
              <h3>Fundamentos extraídos</h3>
              <pre>{JSON.stringify(extraction.tokens, null, 2)}</pre>
              {extraction.limitations.map((x) => (
                <p key={x}>{x}</p>
              ))}
            </>
          ) : null}
          <button
            disabled={approved}
            onClick={() => {
              try {
                const next = normalizeDesign(JSON.parse(draft), spec.source);
                setSpec(next);
                setApproved(true);
                setError("");
              } catch {
                setError(
                  "Aplique ou corrija a edição da estrutura antes de aprovar.",
                );
              }
            }}
          >
            Aprovar estrutura e gerar prévia
          </button>
        </section>
      ) : null}
      {files ? (
        <section>
          <h2>2. Prévia e arquivos</h2>
          <p>
            Protótipo estático revisável. Os elementos gerados não conectam
            serviços, enviam formulários ou publicam um site.
          </p>
          <iframe
            title="Prévia da interface criada"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={previewDocument(files)}
          />
          <div className={styles.actions}>
            <button
              onClick={() =>
                download(
                  "interface-jk.zip",
                  designZip(
                    Object.fromEntries(
                      Object.entries(files).filter(
                        ([name]) => catalog || name !== "design-system.html",
                      ),
                    ),
                  ),
                )
              }
            >
              Baixar projeto ZIP
            </button>
            <button
              onClick={() => download("wireframe.txt", files["wireframe.txt"])}
            >
              Baixar estrutura
            </button>
            <button onClick={() => setCatalog(true)}>
              Aprovar prévia e gerar catálogo
            </button>
          </div>
          {catalog ? (
            <>
              <h3>3. Catálogo de componentes</h3>
              <p>
                Catálogo do protótipo gerado, com fundamentos, regiões e origem.
              </p>
              <iframe
                title="Catálogo de componentes"
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={previewDocument({
                  ...files,
                  "index.html": files["design-system.html"],
                })}
              />
            </>
          ) : null}
          <details>
            <summary>Ver arquivos gerados</summary>
            {Object.entries(files)
              .filter(([name]) => catalog || name !== "design-system.html")
              .map(([name, text]) => (
                <details key={name}>
                  <summary>{name}</summary>
                  <pre>{text}</pre>
                  <button
                    onClick={() => download(name.replaceAll("/", "-"), text)}
                  >
                    Baixar arquivo
                  </button>
                </details>
              ))}
          </details>
        </section>
      ) : null}
    </div>
  );
}
