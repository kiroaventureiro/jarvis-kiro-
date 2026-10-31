/** Codex-inspired, fail-closed action admission. Pure policy; never executes tools. */
export type JarvisAction = "read_project" | "inspect_status" | "edit_code" | "publish" | "delete_data" | "send_message";
export type ApprovalEvidence = {
  action: JarvisAction;
  resource: string;
  ownerId: string;
  expiresAt: string;
  consumed: boolean;
  /** Must originate from authenticated server-side approval storage, never a client payload. */
  serverVerified: boolean;
};
export type ActionRequest = {
  action: JarvisAction;
  resource: string;
  ownerId?: string;
  verifiedConnection?: boolean;
  /** Legacy boolean is intentionally ignored: it cannot authorize a write. */
  approved?: boolean;
  approvalEvidence?: ApprovalEvidence;
};
export type Admission = { allowed: boolean; requiresApproval: boolean; reason: string };
const readOnly = new Set<JarvisAction>(["read_project", "inspect_status"]);
const validActions = new Set<JarvisAction>([
  "read_project", "inspect_status", "edit_code", "publish", "delete_data", "send_message",
]);
export function admitJarvisAction(request: ActionRequest, now = Date.now()): Admission {
  if (!request || !validActions.has(request.action) ||
      typeof request.resource !== "string" || !request.resource.trim() ||
      request.resource.length > 250)
    return { allowed: false, requiresApproval: false, reason: "invalid_action" };
  const requiresApproval = !readOnly.has(request.action);
  if (request.verifiedConnection !== true)
    return { allowed: false, requiresApproval, reason: "connection_unverified" };
  if (!requiresApproval)
    return { allowed: true, requiresApproval: false, reason: "admitted_for_executor_validation" };
  const proof = request.approvalEvidence;
  if (!proof || proof.serverVerified !== true ||
      !request.ownerId || proof.ownerId !== request.ownerId ||
      proof.action !== request.action || proof.resource !== request.resource ||
      proof.consumed !== false || typeof proof.expiresAt !== "string" ||
      !Number.isFinite(now) || !Number.isFinite(Date.parse(proof.expiresAt)) ||
      Date.parse(proof.expiresAt) <= now)
    return { allowed: false, requiresApproval: true, reason: "matching_fresh_approval_required" };
  return { allowed: true, requiresApproval: true, reason: "admitted_for_executor_validation" };
}
/**
 * This is a preflight check, NOT a security boundary. The real executor must load
 * the approval from authenticated server storage, atomically consume it, verify
 * scope/identity/provider permission and audit execution. Never pass client
 * supplied ApprovalEvidence as proof.
 */
