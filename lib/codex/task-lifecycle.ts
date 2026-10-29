/**
 * Codex task lifecycle is a pure state machine. It does not queue or run jobs.
 * Future authenticated workers must provide verified evidence for transitions.
 */
export type CodexTaskState = "draft" | "approved" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type CodexTaskRecord = {
  id: string;
  state: CodexTaskState;
  repository: string;
  branch: string;
  kind?: "review" | "test" | "implement";
  instruction?: string;
  createdAt: string;
  updatedAt: string;
  resultReference?: string;
};
const allowed: Record<CodexTaskState, CodexTaskState[]> = {
  draft: ["approved", "cancelled"],
  approved: ["queued", "cancelled"],
  queued: ["running", "failed", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [], failed: [], cancelled: [],
};
export function transitionCodexTask(task: CodexTaskRecord, next: CodexTaskState, evidence: {
  approvalVerified?: boolean;
  workerVerified?: boolean;
  resultReference?: string;
}, now: string): CodexTaskRecord {
  if (!allowed[task.state].includes(next)) throw Error("INVALID_TRANSITION");
  if (next === "approved" && evidence.approvalVerified !== true) throw Error("APPROVAL_REQUIRED");
  if (["queued", "running", "completed", "failed"].includes(next) && evidence.workerVerified !== true)
    throw Error("VERIFIED_WORKER_REQUIRED");
  if (next === "completed" && (!evidence.resultReference || evidence.resultReference.length > 500))
    throw Error("VERIFIED_RESULT_REQUIRED");
  if (!Number.isFinite(Date.parse(now))) throw Error("INVALID_TIMESTAMP");
  return {...task, state:next, updatedAt:now,
    ...(next==="completed" ? {resultReference:evidence.resultReference} : {})};
}
