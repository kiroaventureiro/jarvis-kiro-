"use client";
import Link from "next/link";
import { useRef, useState } from "react";
export const areas = [
  ["/", "Jarvis"],
  ["/integracoes", "Integrações"],
  ["/memoria", "Memória"],
  ["/projetos", "Projetos"],
  ["/controle", "Controle"],
  ["/diagnostico", "Diagnóstico"],
  ["/configuracoes", "Configurações"],
] as const;
export default function JarvisNavigation() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="navigation"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="icon-button"
        aria-label={open ? "Fechar navegação" : "Abrir navegação"}
        aria-expanded={open}
        aria-controls="jarvis-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? "×" : "☰"}
      </button>
      {open ? (
        <nav id="jarvis-navigation" aria-label="Áreas do Jarvis">
          {areas.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
