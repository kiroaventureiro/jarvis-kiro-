"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { FlowEvidence } from "../../../lib/holo/director";
export function useHoloAutoFlow({
  root,
  stepId,
  playing,
  instant = false,
  onEvidence,
}: {
  root: RefObject<HTMLDivElement | null>;
  stepId: string;
  playing: boolean;
  instant?: boolean;
  onEvidence: (e: FlowEvidence) => void;
}) {
  const active = useRef(playing),
    still = useRef(instant);
  active.current = playing;
  still.current = instant;
  useEffect(() => {
    const host = root.current,
      body = host?.querySelector<HTMLElement>(".holo-panel-body");
    if (!host || !body) return;
    body.scrollTop = 0;
    let timer: ReturnType<typeof setTimeout> | undefined,
      closed = false,
      last = performance.now(),
      dwell = 0,
      observedBottom = 0,
      lastMaximum = 0,
      pageDwell = 0;
    const measure = () => {
      timer = undefined;
      if (closed) return;
      const now = performance.now(),
        delta = Math.min(300, now - last);
      last = now;
      const pending = !!host.querySelector("[data-holo-pending]"),
        writing = !!host.querySelector(
          '[data-holo-writing="true"],[data-holo-chart-ready="false"]',
        ),
        max = Math.max(0, body.scrollHeight - body.clientHeight);
      if (max < lastMaximum - 10)
        observedBottom = Math.min(observedBottom, max);
      lastMaximum = max;
      if (active.current && !document.hidden) {
        const writers = [
            ...body.querySelectorAll<HTMLElement>('[data-holo-writing="true"]'),
          ],
          latest = writers.at(-1);
        // Follow newly projected text within this panel only; never scroll the page.
        let target = host.querySelector('[data-holo-chart-ready="false"]')
          ? body.scrollTop
          : max;
        if (latest) {
          const bottom =
            latest.getBoundingClientRect().bottom -
            body.getBoundingClientRect().bottom +
            body.scrollTop +
            14;
          target = Math.max(0, Math.min(max, bottom));
        }
        if (target > body.scrollTop + 2) {
          const staticMotion =
            still.current ||
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (staticMotion) {
            pageDwell += delta;
            if (pageDwell >= 1800) {
              body.scrollTop = Math.min(
                target,
                body.scrollTop + Math.max(40, body.clientHeight * 0.7),
              );
              pageDwell = 0;
            }
          } else
            body.scrollTop = Math.min(target, body.scrollTop + delta * 0.045);
        }
        observedBottom = Math.max(observedBottom, body.scrollTop);
        if (!writing && !pending && body.scrollTop >= max - 2) dwell += delta;
        else dwell = 0;
      }
      const seen =
        body.clientHeight >= 48 &&
        (max <= 2 ||
          (!writing && !pending && observedBottom >= max - 2 && dwell >= 800));
      onEvidence({
        stepId,
        written: !writing && !pending,
        seen,
        unseenPixels: Math.max(0, max - observedBottom),
        visibleHeight: body.clientHeight,
      });
      host.dataset.flowWritten = String(!writing && !pending);
      host.dataset.flowSeen = String(seen);
      host.dataset.flowOverflow = String(Math.round(max));
      timer = setTimeout(measure, 160);
    };
    const invalidate = () => {
      if (!timer) timer = setTimeout(measure, 100);
    };
    const resize = new ResizeObserver(invalidate);
    resize.observe(body);
    const mutations = new MutationObserver(invalidate);
    mutations.observe(body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-holo-writing", "data-holo-chart-ready"],
    });
    void document.fonts?.ready.then(() => {
      if (!closed) invalidate();
    });
    measure();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [root, stepId, onEvidence]);
}
