"use client";
import { useContext, useEffect, useMemo, useState } from "react";
import { HoloPlaybackContext } from "./HoloPlaybackContext";
import {
  highlightedRuns,
  revealPlan,
  visibleUnits,
  type TextRole,
} from "../../../lib/holo/reveal";
export default function HoloTypewriter({
  text,
  role = "body",
  delay = 0,
  transient = false,
}: {
  text: string;
  role?: TextRole;
  delay?: number;
  transient?: boolean;
}) {
  const playback = useContext(HoloPlaybackContext),
    plan = useMemo(() => revealPlan(text, role), [text, role]),
    [localElapsed, setLocalElapsed] = useState(0),
    [reduced, setReduced] = useState(false),
    [localStatic, setLocalStatic] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const read = () => {
      try {
        setLocalStatic(localStorage.getItem("jk-holo-motion") === "static");
      } catch {}
    };
    read();
    window.addEventListener("jk-holo-motion", read);
    return () => window.removeEventListener("jk-holo-motion", read);
  }, []);
  useEffect(() => setLocalElapsed(0), [text]);
  const directed = playback.elapsed !== undefined;
  useEffect(() => {
    if (
      directed ||
      !playback.playing ||
      playback.instant ||
      localStatic ||
      reduced
    )
      return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = Math.min(250, now - last);
      last = now;
      if (!document.hidden)
        setLocalElapsed((v) => {
          const limit = transient ? plan.duration + 9000 : plan.duration;
          const next = Math.min(limit, v + delta);
          if (next >= limit) clearInterval(timer);
          return next;
        });
    }, 100);
    return () => clearInterval(timer);
  }, [
    directed,
    playback.playing,
    playback.instant,
    localStatic,
    reduced,
    plan.duration,
    transient,
  ]);
  const elapsed = playback.elapsed ?? localElapsed,
    offset =
      delay +
      (playback.automatic && role !== "title"
        ? role === "body"
          ? playback.bodyStart || 0
          : (playback.subtitleStart ?? playback.bodyStart ?? 0)
        : 0),
    count =
      playback.instant || localStatic || reduced
        ? plan.units.length
        : visibleUnits(plan, elapsed - offset),
    visible = plan.units.slice(0, count).join(""),
    finished = count >= plan.units.length;
  const runs = useMemo(
    () => highlightedRuns(visible, playback.highlights || []),
    [visible, playback.highlights],
  );
  return (
    <span
      className={
        "holo-text-stream holo-role-" +
        role +
        (transient && elapsed > plan.duration + 9000 ? " is-faded" : "")
      }
      aria-label={text}
      data-holo-writing={!finished}
      data-text-role={role}
    >
      <span className="holo-sr-only">{text}</span>
      <span aria-hidden="true">
        {runs.map((run, i) =>
          run.kind ? (
            <mark key={i} className={"holo-highlight is-" + run.kind}>
              {run.text}
            </mark>
          ) : (
            <span key={i}>{run.text}</span>
          ),
        )}
        <i className={!finished ? "holo-caret" : ""} />
      </span>
    </span>
  );
}
