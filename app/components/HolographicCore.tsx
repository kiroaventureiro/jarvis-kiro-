"use client";
import { memo, useEffect, useId, useRef, useState } from "react";
import JKMonogram from "./JKMonogram";
import { observeAudio, type AudioEnvelope } from "../../lib/hologram/audio";
import {
  AdaptiveResolution,
  canvasSize,
  graphicsProfile,
  phaseEnergy,
  readGraphicsPreference,
  GRAPHICS_KEY,
  type CorePhase,
  type GraphicsPreference,
  type AudioVisualMode,
} from "../../lib/hologram/policy";
import type { HologramRenderer } from "../../lib/hologram/webgl";
type Props = {
  phase: CorePhase;
  hidden: boolean;
  inputStream: MediaStream | null;
  outputStream: MediaStream | null;
  muted: boolean;
  onVisualMode: (mode: AudioVisualMode) => void;
};
function ShellFallback() {
  const id = useId().replace(/:/g, "");
  return (
    <svg className="jk-fallback" viewBox="-150 -100 300 200" aria-hidden="true">
      <defs>
        <radialGradient id={id + "shell"}>
          <stop stopColor="#15b4ff" stopOpacity=".22" />
          <stop offset=".75" stopColor="#087bff" stopOpacity=".05" />
          <stop offset=".97" stopColor="#42dfff" stopOpacity=".45" />
          <stop offset="1" stopColor="#b9faff" stopOpacity=".8" />
        </radialGradient>
      </defs>
      <circle
        r="75"
        fill={"url(#" + id + "shell)"}
        stroke="#42dfff"
        strokeOpacity=".7"
        strokeWidth=".6"
      />
      <g
        className="jk-fallback-shell"
        fill="none"
        stroke="#42dfff"
        strokeWidth=".55"
      >
        {[0, 35, 73, 118, 150].map((angle, i) => (
          <ellipse
            key={angle}
            rx={26 + i * 4}
            ry="75"
            transform={"rotate(" + angle + ")"}
            opacity={0.22 + i * 0.08}
          />
        ))}
        <ellipse rx="75" ry="27" transform="rotate(16)" opacity=".6" />
        <ellipse rx="75" ry="42" transform="rotate(-31)" opacity=".3" />
      </g>
      {[
        [-13, 110, 23],
        [22, 103, 31],
        [-39, 98, 28],
        [40, 102, 20],
      ].map(([angle, rx, ry], i) => (
        <g
          className={"jk-fallback-orbit jk-fallback-orbit-" + i}
          key={angle}
          transform={"rotate(" + angle + ")"}
        >
          <ellipse
            rx={rx}
            ry={ry}
            fill="none"
            stroke={i > 1 ? "#8774ff" : "#8beeff"}
            strokeWidth=".65"
            opacity=".7"
          />
          <ellipse
            rx={rx}
            ry={ry}
            fill="none"
            stroke="#e2faff"
            strokeWidth="1.1"
            strokeDasharray="18 45 1 140"
            opacity=".9"
          />
        </g>
      ))}
    </svg>
  );
}
function HolographicCore(props: Props) {
  const root = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(props),
    envelope = useRef<AudioEnvelope | null>(null),
    refresh = useRef<() => void>(() => {});
  latest.current = props;
  const [preference, setPreference] = useState<GraphicsPreference>("auto"),
    [renderer, setRenderer] = useState("loading");
  useEffect(() => {
    setPreference(readGraphicsPreference());
    const changed = (e: Event) =>
      setPreference(
        e.type === "jarvis-graphics"
          ? (e as CustomEvent).detail === "eco"
            ? "eco"
            : "auto"
          : readGraphicsPreference(),
      );
    const storage = (e: StorageEvent) => {
      if (e.key === GRAPHICS_KEY) changed(e);
    };
    window.addEventListener("jarvis-graphics", changed);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("jarvis-graphics", changed);
      window.removeEventListener("storage", storage);
    };
  }, []);
  useEffect(() => {
    const stream =
      props.phase === "listening"
        ? props.inputStream
        : props.phase === "responding" && !props.muted
          ? props.outputStream
          : null;
    const observer = observeAudio(
      props.hidden || renderer !== "webgl" ? null : stream,
      props.phase === "listening" ? "input-level" : "output-level",
    );
    envelope.current = observer;
    props.onVisualMode(observer.mode);
    if (root.current) root.current.dataset.audioVisual = observer.mode;
    return () => {
      observer.dispose();
      if (envelope.current === observer) envelope.current = null;
    };
  }, [
    props.phase,
    props.inputStream,
    props.outputStream,
    props.muted,
    props.hidden,
    props.onVisualMode,
    renderer,
  ]);
  useEffect(() => {
    const element = canvas.current,
      host = root.current;
    if (!element || !host) return;
    let cancelled = false,
      lost = false,
      engine: HologramRenderer | null = null,
      raf = 0,
      last = 0,
      elapsed = 0,
      lastMode: AudioVisualMode = "representative";
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let profile = graphicsProfile(
        preference,
        window.innerWidth,
        devicePixelRatio,
        navigator.hardwareConcurrency,
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      ),
      adaptive = new AdaptiveResolution(profile.dpr);
    const active = () =>
      !cancelled && !lost && !document.hidden && !latest.current.hidden;
    const size = () => {
      const box = element.getBoundingClientRect(),
        dimensions = canvasSize(box.width, box.height, adaptive.dpr);
      if (
        element.width !== dimensions.width ||
        element.height !== dimensions.height
      ) {
        element.width = dimensions.width;
        element.height = dimensions.height;
      }
      host.dataset.dpr = dimensions.dpr.toFixed(2);
    };
    const draw = (time: number) => {
      if (!engine || !active()) return;
      const amplitude = envelope.current?.read() ?? null;
      const mode =
        amplitude === null ? "representative" : envelope.current!.mode;
      if (mode !== lastMode) {
        lastMode = mode;
        latest.current.onVisualMode(mode);
      }
      host.dataset.audioVisual = mode;
      const energy = phaseEnergy(latest.current.phase, time, amplitude);
      engine.draw(time, energy.energy, energy.speed, adaptive.dpr);
      host.style.setProperty("--jk-energy", String(energy.energy));
    };
    const frame = (stamp: number) => {
      raf = 0;
      if (!active() || !engine) return;
      const target = 1000 / profile.fps,
        interval = last ? stamp - last : target;
      if (interval >= target - 1) {
        if (last && adaptive.observe(interval, target)) size();
        if (adaptive.fallback) {
          engine.dispose();
          engine = null;
          host.dataset.fallbackReason = "performance";
          setRenderer("fallback");
          return;
        }
        const delta = Math.min(interval, 100) / 1000;
        elapsed +=
          delta * phaseEnergy(latest.current.phase, elapsed, null).speed;
        last = stamp;
        draw(elapsed);
      }
      if (!motion.matches) raf = requestAnimationFrame(frame);
    };
    const pause = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };
    const reconcile = () => {
      pause();
      host.dataset.motion = motion.matches ? "reduced" : "animated";
      if (!active() || !engine) return;
      if (motion.matches) draw(elapsed);
      else raf = requestAnimationFrame(frame);
    };
    refresh.current = reconcile;
    const resize = () => {
      size();
      if (motion.matches) draw(elapsed);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      pause();
      engine?.dispose();
      engine = null;
      setRenderer("fallback");
    };
    const boot = async () => {
      try {
        const { createHologramRenderer } = await import(
          "../../lib/hologram/webgl"
        );
        if (cancelled) return;
        engine?.dispose();
        profile = graphicsProfile(
          preference,
          window.innerWidth,
          devicePixelRatio,
          navigator.hardwareConcurrency,
          (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
        );
        adaptive = new AdaptiveResolution(profile.dpr);
        engine = createHologramRenderer(element, profile.particles);
        if (!engine) {
          setRenderer("fallback");
          return;
        }
        host.dataset.quality = profile.low ? "eco" : "standard";
        host.dataset.particles = String(engine.particles);
        host.dataset.fps = String(profile.fps);
        size();
        draw(elapsed);
        setRenderer("webgl");
        reconcile();
      } catch {
        if (!cancelled) setRenderer("fallback");
      }
    };
    const restored = () => {
      lost = false;
      void boot();
    };
    element.addEventListener("webglcontextlost", contextLost);
    element.addEventListener("webglcontextrestored", restored);
    document.addEventListener("visibilitychange", reconcile);
    motion.addEventListener("change", reconcile);
    void boot();
    return () => {
      cancelled = true;
      pause();
      refresh.current = () => {};
      observer.disconnect();
      element.removeEventListener("webglcontextlost", contextLost);
      element.removeEventListener("webglcontextrestored", restored);
      document.removeEventListener("visibilitychange", reconcile);
      motion.removeEventListener("change", reconcile);
      engine?.dispose();
    };
  }, [preference]);
  useEffect(() => refresh.current(), [props.phase, props.hidden]);
  return (
    <div
      ref={root}
      className="hologram jk-core"
      data-renderer={renderer}
      data-phase={props.phase}
      data-preference={preference}
      aria-hidden="true"
    >
      <div className="jk-aura" />
      <div className="jk-light-column" />
      <canvas ref={canvas} className="jk-canvas" />
      <ShellFallback />
      <JKMonogram />
      <div className="jk-emitter">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export default memo(HolographicCore);
