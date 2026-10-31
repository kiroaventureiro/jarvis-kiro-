/** Pure state machine for jarvis_jobs, compatible with existing SQL statuses. */
export type JobState = "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobEvent = "start" | "complete" | "fail" | "cancel" | "retry";
export type JobTransition = { accepted: boolean; state: JobState; reason: string };
const transitions: Record<JobState, Partial<Record<JobEvent, JobState>>> = {
  queued: { start: "running", cancel: "cancelled" },
  running: { complete: "completed", fail: "failed", cancel: "cancelled" },
  completed: {},
  failed: { retry: "queued" },
  cancelled: {},
};
/** Advisory transition: DB writes must use compare-and-swap and authenticated ownership. */
export function transitionJarvisJob(state: JobState, event: JobEvent): JobTransition {
  if (!Object.prototype.hasOwnProperty.call(transitions, state) ||
      !["start", "complete", "fail", "cancel", "retry"].includes(event))
    return { accepted: false, state, reason: "invalid_transition" };
  const next = transitions[state][event];
  return next
    ? { accepted: true, state: next, reason: "allowed" }
    : { accepted: false, state, reason: "invalid_transition" };
}
