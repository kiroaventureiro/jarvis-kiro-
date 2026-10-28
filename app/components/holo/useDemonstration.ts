"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HoloScene } from "../../../lib/holo/types";
import { presentationPlan, planDuration } from "../../../lib/holo/presentation";
import { HoloDirector, type FlowEvidence } from "../../../lib/holo/director";
import type { PresentationSpace } from "../../../lib/holo/content-planner";
import {
  SPEECH_PROGRESS_EVENT,
  type SpeechProgress,
} from "../../../lib/holo/speech-progress";
export function useDemonstration(scene: HoloScene, space?: PresentationSpace) {
  const plan = useMemo(
      () => presentationPlan(scene, space),
      [scene, space?.width, space?.height],
    ),
    machine = useRef<HoloDirector | null>(null);
  if (!machine.current) machine.current = new HoloDirector(plan);
  const [snapshot, setSnapshot] = useState(machine.current.state),
    [speed, setSpeed] = useState(1),
    [instant, setInstant] = useState(false),
    [sync, setSync] = useState(false),
    [spokenTerm, setSpokenTerm] = useState("");
  const flow = useRef<FlowEvidence | undefined>(undefined),
    voice = useRef({ fraction: 0, at: 0, ended: true, boundary: false }),
    rate = useRef(1);
  rate.current = speed;
  useEffect(() => {
    machine.current!.replacePlan(plan);
    flow.current = undefined;
    setSnapshot({ ...machine.current!.state });
  }, [plan]);
  useEffect(() => {
    try {
      setInstant(localStorage.getItem("jk-holo-motion") === "static");
    } catch {}
  }, []);
  const setNoAnimation = useCallback((value: boolean) => {
    setInstant(value);
    try {
      localStorage.setItem("jk-holo-motion", value ? "static" : "animated");
    } catch {}
    window.dispatchEvent(new Event("jk-holo-motion"));
  }, []);
  useEffect(() => {
    const speech = (event: Event) => {
      const d = (event as CustomEvent<SpeechProgress>).detail;
      if (!d || !Number.isFinite(d.fraction)) return;
      if (d.phase === "cancel") {
        machine.current!.pause();
        setSnapshot({ ...machine.current!.state });
        setSync(false);
        return;
      }
      if (d.phase === "start" || d.phase === "boundary") {
        voice.current = {
          fraction: d.fraction,
          at: performance.now(),
          ended: false,
          boundary: d.phase === "boundary",
        };
        setSync(d.phase === "boundary");
        if (d.phase === "boundary") {
          const fragment = (scene.narration || "").slice(
            Math.max(0, d.charIndex - 12),
            d.charIndex + 42,
          );
          const term =
            fragment.match(/IPCA|Selic|d[oó]lar|c[aâ]mbio/i)?.[0] || "";
          setSpokenTerm(term);
        }
      } else {
        voice.current.ended = true;
        setSync(false);
        setSpokenTerm("");
      }
    };
    window.addEventListener(SPEECH_PROGRESS_EVENT, speech);
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = now - last;
      last = now;
      const old = machine.current!.state,
        fresh = voice.current.boundary && now - voice.current.at < 4000;
      const next = machine.current!.tick(
        delta,
        flow.current,
        { fraction: voice.current.fraction, fresh, ended: voice.current.ended },
        rate.current,
        !document.hidden,
      );
      if (next !== old) setSnapshot({ ...next });
      if (!fresh) setSync(false);
    }, 100);
    return () => {
      clearInterval(timer);
      window.removeEventListener(SPEECH_PROGRESS_EVENT, speech);
    };
  }, [scene.id, scene.narration]);
  const act = useCallback((action: "pause" | "resume" | "replay") => {
    machine.current![action]();
    setSnapshot({ ...machine.current!.state });
  }, []);
  const reportFlow = useCallback((e: FlowEvidence) => {
    flow.current = e;
  }, []);
  const index = Math.min(snapshot.index, Math.max(0, plan.length - 1)),
    step = plan[index],
    finished = snapshot.status === "complete",
    playing = snapshot.status === "playing";
  return {
    plan,
    step,
    index,
    elapsed: snapshot.elapsed,
    duration: planDuration(plan),
    progress: step
      ? Math.max(
          0,
          Math.min(
            1,
            (snapshot.elapsed - step.reveal.bodyStart) /
              Math.max(1, step.reveal.completeAt - step.reveal.bodyStart),
          ),
        )
      : 1,
    playing,
    finished,
    sync,
    spokenTerm,
    instant,
    setNoAnimation,
    speed,
    setSpeed,
    issue: snapshot.issue,
    reportFlow,
    pause: () => act("pause"),
    resume: () => act("resume"),
    replay: () => act("replay"),
    jump: (index: number) => {
      machine.current!.jump(index);
      setSnapshot({ ...machine.current!.state });
    },
  };
}
