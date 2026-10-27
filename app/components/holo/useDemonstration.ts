"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HoloScene } from "../../../lib/holo/types";
import {
  presentationPlan,
  planDuration,
  stepAt,
} from "../../../lib/holo/presentation";
import {
  SPEECH_PROGRESS_EVENT,
  type SpeechProgress,
} from "../../../lib/holo/speech-progress";
export function useDemonstration(scene: HoloScene) {
  const plan = useMemo(() => presentationPlan(scene), [scene]),
    duration = planDuration(plan);
  const [elapsed, setElapsed] = useState(0),
    [playing, setPlaying] = useState(true),
    [speed, setSpeed] = useState(1),
    [sync, setSync] = useState(false),
    [manual, setManual] = useState(false);
  const clock = useRef({
      last: 0,
      voice: 0,
      voiceAt: 0,
      boundary: false,
      ended: false,
    }),
    play = useRef(true),
    rate = useRef(1);
  play.current = playing;
  rate.current = speed;
  useEffect(() => {
    const start = performance.now();
    clock.current = {
      last: start,
      voice: 0,
      voiceAt: 0,
      boundary: false,
      ended: false,
    };
    const speech = (event: Event) => {
      const d = (event as CustomEvent<SpeechProgress>).detail;
      if (!d || !Number.isFinite(d.fraction)) return;
      if (d.phase === "cancel") {
        setPlaying(false);
        return;
      }
      if (d.phase === "start" || d.phase === "boundary") {
        clock.current.voice = d.fraction;
        clock.current.voiceAt = performance.now();
        clock.current.boundary = d.phase === "boundary";
        clock.current.ended = false;
        setSync(true);
      }
      if (d.phase === "end" || d.phase === "error") {
        clock.current.ended = true;
        setSync(false);
      }
    };
    window.addEventListener(SPEECH_PROGRESS_EVENT, speech);
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = Math.min(400, now - clock.current.last);
      clock.current.last = now;
      if (!play.current || document.hidden) return;
      setElapsed((e) => {
        const baseline = e + delta * rate.current;
        const voiceTarget = clock.current.voice * duration;
        return Math.min(
          duration,
          voiceTarget > e + 1500
            ? Math.min(e + delta * 2, voiceTarget)
            : baseline,
        );
      });
    }, 100);
    return () => {
      clearInterval(timer);
      window.removeEventListener(SPEECH_PROGRESS_EVENT, speech);
    };
  }, [scene.id, duration]);
  const cursor = stepAt(plan, elapsed);
  const jump = (index: number) => {
    setManual(true);
    setElapsed(plan.slice(0, index).reduce((s, p) => s + p.duration, 0));
    setPlaying(false);
  };
  return {
    plan,
    duration,
    elapsed,
    step: plan[cursor.index],
    index: cursor.index,
    progress: cursor.progress,
    finished: cursor.finished,
    playing: playing && !cursor.finished,
    sync,
    manual,
    speed,
    setSpeed,
    pause: () => setPlaying(false),
    resume: () => {
      setManual(false);
      setPlaying(true);
    },
    replay: () => {
      setElapsed(0);
      setManual(false);
      setPlaying(true);
    },
    jump,
  };
}
