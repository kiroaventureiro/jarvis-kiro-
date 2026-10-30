"use client";
import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { areas } from "./JarvisNavigation";
import { readGraphicsPreference } from "../../lib/hologram/policy";
import type { CorePhase, AudioVisualMode } from "../../lib/hologram/policy";

type Props = {
  phase: CorePhase;
  hidden: boolean;
  inputStream: MediaStream | null;
  outputStream: MediaStream | null;
  muted: boolean;
  onVisualMode: (mode: AudioVisualMode) => void;
};
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/** Raster reference with progressive CSS depth. No generated 3D geometry or microphone access. */
function CosmicScene({ phase, hidden, onVisualMode }: Props) {
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [paused, setPaused] = useState(true);
  const [entered, setEntered] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  useEffect(() => {
    onVisualMode("representative");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    let inViewport = true;
    const update = () =>
      setPaused(
        !inViewport ||
          document.hidden ||
          reduced.matches ||
          readGraphicsPreference() === "eco" ||
          !!connection?.saveData,
      );
    update();
    reduced.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("jarvis-graphics", update);
    // Cancel only a multi-touch gesture; a single finger remains native page scroll.
    const el = root.current;
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            inViewport = entries[0]?.isIntersecting !== false;
            update();
          })
        : null;
    if (el) observer?.observe(el);
    let previous: { distance: number; x: number; y: number } | null = null;
    const touch = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        previous = null;
        return;
      }
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const next = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      };
      if (previous && e.type === "touchmove") {
        const old = previous;
        setView((v) => ({
          zoom: clamp(
            (v.zoom * next.distance) / Math.max(1, old.distance),
            1,
            3,
          ),
          x: clamp(v.x + next.x - old.x, -180, 180),
          y: clamp(v.y + next.y - old.y, -120, 120),
        }));
      }
      previous = next;
    };
    el?.addEventListener("touchmove", touch, { passive: false });
    el?.addEventListener("touchstart", touch, { passive: false });
    el?.addEventListener("touchend", touch);
    return () => {
      reduced.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("jarvis-graphics", update);
      el?.removeEventListener("touchmove", touch);
      el?.removeEventListener("touchstart", touch);
      el?.removeEventListener("touchend", touch);
      observer?.disconnect();
    };
  }, [onVisualMode]);
  useEffect(() => {
    const progress = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.phase === "start") setSpeechActive(true);
      else if (["end", "error", "cancel"].includes(detail?.phase))
        setSpeechActive(false);
    };
    window.addEventListener("jk-speech-progress", progress);
    return () => window.removeEventListener("jk-speech-progress", progress);
  }, []);
  function reset() {
    setView({ zoom: 1, x: 0, y: 0 });
    setEntered(false);
  }
  function enter() {
    setEntered(true);
    setView({ zoom: 2.6, x: 0, y: 0 });
    document.getElementById("cosmic-systems")?.scrollIntoView({
      behavior: paused ? "instant" : "smooth",
      block: "start",
    });
  }
  return (
    <div
      ref={root}
      className="cosmic-scene"
      data-phase={speechActive && phase === "idle" ? "responding" : phase}
      data-paused={paused}
      data-entered={entered}
      data-hidden={hidden}
      data-zoom={view.zoom.toFixed(2)}
    >
      <div
        className="cosmic-viewport"
        role="group"
        aria-label="Cena cósmica interativa. Arraste com o mouse; use mais e menos para aproximar, Home para restaurar. No toque, use dois dedos para aproximar."
        tabIndex={0}
        onKeyDown={(e) => {
          if (
            ![
              "+",
              "=",
              "-",
              "Home",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Escape",
            ].includes(e.key)
          )
            return;
          e.preventDefault();
          if (e.key === "Home" || e.key === "Escape") reset();
          else
            setView((v) => ({
              zoom: clamp(
                v.zoom +
                  (e.key === "+" || e.key === "="
                    ? 0.15
                    : e.key === "-"
                      ? -0.15
                      : 0),
                1,
                3,
              ),
              x: clamp(
                v.x +
                  (e.key === "ArrowLeft"
                    ? -20
                    : e.key === "ArrowRight"
                      ? 20
                      : 0),
                -180,
                180,
              ),
              y: clamp(
                v.y +
                  (e.key === "ArrowUp" ? -20 : e.key === "ArrowDown" ? 20 : 0),
                -120,
                120,
              ),
            }));
        }}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (e.pointerType === "mouse")
            e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const old = pointers.current.get(e.pointerId);
          if (!old) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const pts = [...pointers.current.values()];
          if (pts.length === 2) {
            const distance = Math.hypot(
              pts[0].x - pts[1].x,
              pts[0].y - pts[1].y,
            );
            if (pinch.current)
              setView((v) => ({
                ...v,
                zoom: clamp((v.zoom * distance) / pinch.current!, 1, 3),
                x: clamp(v.x + (e.clientX - old.x) / 2, -180, 180),
                y: clamp(v.y + (e.clientY - old.y) / 2, -120, 120),
              }));
            pinch.current = distance;
          } else if (e.pointerType === "mouse")
            setView((v) => ({
              ...v,
              x: clamp(v.x + e.clientX - old.x, -180, 180),
              y: clamp(v.y + e.clientY - old.y, -120, 120),
            }));
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
        }}
        onLostPointerCapture={(e) => {
          pointers.current.delete(e.pointerId);
          pinch.current = null;
        }}
      >
        <div
          className="cosmic-camera"
          style={
            {
              "--cosmic-zoom": view.zoom,
              "--cosmic-x": view.x + "px",
              "--cosmic-y": view.y + "px",
            } as CSSProperties
          }
        >
          <img
            className="cosmic-reference"
            src="/cosmic/star-orbiting-black-hole.jpg"
            alt="Jarvis: buraco negro central com disco de acreção dourado e laranja, alimentado por uma estrela azul em um campo estelar."
            draggable={false}
            fetchPriority="high"
          />
          <div className="cosmic-accretion" aria-hidden="true" />
          <div className="cosmic-flow" aria-hidden="true" />
          <div className="cosmic-orbit" aria-hidden="true">
            <span className="cosmic-star" />
          </div>
        </div>
      </div>
      <div className="cosmic-tools" aria-label="Explorar o Jarvis">
        <button
          onClick={() =>
            setView((v) => ({ ...v, zoom: clamp(v.zoom + 0.2, 1, 3) }))
          }
          aria-label="Aproximar cena"
        >
          +
        </button>
        <button
          onClick={() =>
            setView((v) => ({ ...v, zoom: clamp(v.zoom - 0.2, 1, 3) }))
          }
          aria-label="Afastar cena"
        >
          −
        </button>
        <button onClick={reset} aria-label="Restaurar enquadramento">
          Restaurar
        </button>
        <button onClick={enter} aria-controls="cosmic-systems">
          Entrar no núcleo
        </button>
      </div>
    </div>
  );
}
export function CosmicSystems() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const items = root.current?.querySelectorAll(".gravity-link");
    if (!items || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) =>
          e.target.classList.toggle("is-visible", e.isIntersecting),
        ),
      { threshold: 0.12 },
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return (
    <section
      className="cosmic-systems"
      id="cosmic-systems"
      ref={root}
      aria-labelledby="cosmic-systems-title"
    >
      <div className="cosmic-systems-intro">
        <span>INTERIOR DO NÚCLEO</span>
        <h2 id="cosmic-systems-title">Seu universo de trabalho.</h2>
        <p>
          As ferramentas aparecem conforme você avança. Abra uma área para
          consultar seus dados e controles.
        </p>
        <a href="#cosmic-home">Voltar à cena</a>
      </div>
      <nav
        className="gravity-navigation"
        aria-label="Componentes do sistema Jarvis"
      >
        {areas
          .filter(([href]) => href !== "/")
          .map(([href, label], i) => (
            <Link className="gravity-link" key={href} href={href}>
              <span className="gravity-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{label}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
      </nav>
    </section>
  );
}
export default memo(CosmicScene);
