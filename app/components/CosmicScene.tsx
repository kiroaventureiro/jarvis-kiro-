"use client";
import { memo, useEffect, useId, useRef, useState } from "react";
import {
  readGraphicsPreference,
  phaseEnergy,
  type CorePhase,
  type AudioVisualMode,
} from "../../lib/hologram/policy";
import type { createCosmicRenderer } from "../../lib/hologram/cosmic-canvas";
type Props = {
  phase: CorePhase;
  hidden: boolean;
  inputStream: MediaStream | null;
  outputStream: MediaStream | null;
  muted: boolean;
  onVisualMode: (mode: AudioVisualMode) => void;
};
function CosmicScene(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const refresh = useRef<() => void>(() => {});
  const latest = useRef(props);
  latest.current = props;
  const [rendererState, setRendererState] = useState("loading");
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let renderer: ReturnType<typeof createCosmicRenderer> = null;
    let disposed = false,
      raf = 0,
      previous = 0,
      time = 0,
      pendingResize = true;
    let x = 0,
      y = 0,
      targetX = 0,
      targetY = 0,
      speechActive = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const network = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    const paused = () =>
      reduced.matches ||
      readGraphicsPreference() === "eco" ||
      !!network?.saveData;
    props.onVisualMode("representative");
    function size() {
      if (!el) return;
      const rect = el.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, rect.width < 600 ? 1.1 : 1.25);
      const ratio = Math.min(
        dpr,
        Math.sqrt(800_000 / Math.max(1, rect.width * rect.height)),
      );
      el.width = Math.max(1, Math.round(rect.width * ratio));
      el.height = Math.max(1, Math.round(rect.height * ratio));
      pendingResize = false;
    }
    function frame(now: number) {
      raf = 0;
      if (disposed || document.hidden || !renderer || !el) return;
      const moving = !paused();
      if (now - previous < (el.width < 650 ? 1000 / 24 : 1000 / 30)) {
        raf = requestAnimationFrame(frame);
        return;
      }
      if (pendingResize) size();
      const dt = previous ? Math.min(0.06, (now - previous) / 1000) : 0;
      previous = now;
      if (moving) time += dt;
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      const phase =
        speechActive && latest.current.phase === "idle"
          ? "responding"
          : latest.current.phase;
      const drawStarted = performance.now();
      renderer.draw({
        time,
        energy: phaseEnergy(phase, time, null).energy,
        x: moving ? x : 0,
        y: moving ? y : 0,
        motion: moving,
      });
      el.dataset.drawMs = String(Math.round(performance.now() - drawStarted));
      el.dataset.frame = String(Math.round(time * 1000));
      el.dataset.phase = phase;
      el.dataset.motion = moving ? "animated" : "static";
      if (moving) raf = requestAnimationFrame(frame);
    }
    const wake = () => {
      if (!raf && !disposed) {
        previous = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    refresh.current = wake;
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        previous = 0;
      } else wake();
    };
    const pointer = (e: PointerEvent) => {
      targetX = (e.clientX / innerWidth - 0.5) * 2;
      targetY = (e.clientY / innerHeight - 0.5) * 2;
    };
    const speech = (event: Event) => {
      const phase = (event as CustomEvent).detail?.phase;
      if (phase === "start") speechActive = true;
      else if (["end", "cancel", "error"].includes(phase)) speechActive = false;
      wake();
    };
    const observer = new ResizeObserver(() => {
      pendingResize = true;
      wake();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", wake);
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("jarvis-graphics", wake);
    window.addEventListener("jk-speech-progress", speech);
    const camera = (event: Event) => {
      const detail = (event as CustomEvent<{
        active?: boolean; index?: number; focus?: string;
      }>).detail;
      if (!detail?.active || paused()) {
        el.style.transform = "";
        return;
      }
      const step = Math.max(0, Math.min(12, detail.index || 0));
      const direction = step % 4;
      const offsetX = [0, -9, 8, 0][direction];
      const offsetY = [-2, 3, -2, 5][direction];
      const scale = step === 0 ? 1.55 : 1.35 + (step % 3) * 0.13;
      el.style.transform = `translate3d(${offsetX}%, ${offsetY}%, 0) scale(${scale})`;
    };
    window.addEventListener("jk-cosmic-camera", camera);

    void import("../../lib/hologram/cosmic-canvas")
      .then((module) => {
        if (disposed) return;
        renderer = module.createCosmicRenderer(el);
        setRendererState(renderer ? "canvas" : "fallback");
        if (renderer) wake();
      })
      .catch(() => {
        if (!disposed) setRendererState("fallback");
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer?.dispose();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", wake);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("jarvis-graphics", wake);
      window.removeEventListener("jk-speech-progress", speech);
      window.removeEventListener("jk-cosmic-camera", camera);
      el.style.transform = "";
    };
  }, [props.onVisualMode]);
  useEffect(() => {
    refresh.current();
  }, [props.phase, props.muted, props.hidden]);
  return (
    <div
      className="cosmic-scene procedural-cosmos"
      data-renderer={rendererState}
      data-hidden={props.hidden}
    >
      <canvas
        ref={canvas}
        style={{ transition:"transform 1250ms cubic-bezier(.2,.75,.3,1)", transformOrigin:"50% 50%" }}
        role="img"
        aria-label="Jarvis cósmico: buraco negro, plasma dourado e estrela azul, desenhados e animados por código."
      />
      {rendererState !== "canvas" ? (
        <svg
          className="cosmic-vector-fallback"
          viewBox="0 0 1000 700"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={id + "gold"}>
              <stop offset=".35" stopColor="#010207" />
              <stop offset=".56" stopColor="#f9d785" />
              <stop offset=".7" stopColor="#b94d11" />
              <stop offset="1" stopColor="#010207" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={id + "blue"}>
              <stop stopColor="#caf9ff" />
              <stop offset=".5" stopColor="#36baff" />
              <stop offset="1" stopColor="#1164b6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g transform="translate(530 350) rotate(-13)">
            <ellipse rx="380" ry="105" fill={"url(#" + id + "gold)"} />
            <circle r="125" fill={"url(#" + id + "gold)"} />
            <circle r="103" fill="#000102" />
            <path
              d="M-350 45Q-30 100 330 4"
              fill="none"
              stroke="#e8b05d"
              strokeWidth="9"
            />
            <circle cx="-300" cy="-30" r="68" fill={"url(#" + id + "blue)"} />
          </g>
        </svg>
      ) : null}
    </div>
  );
}
export default memo(CosmicScene);
