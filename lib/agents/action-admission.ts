/** Codex-inspired action admission model; pure policy, no execution or network. */
export type JarvisAction = "read_project" | "inspect_status" | "edit_code" | "publish" | "delete_data" | "send_message";
export type ActionRequest = { action: JarvisAction; resource: string; approved?: boolean; verifiedConnection?: boolean };
export type Admission = { allowed: boolean; requiresApproval: boolean; reason: string };
const readOnly = new Set<JarvisAction>(["read_project", "inspect_status"]);
const validActions = new Set<JarvisAction>([
  "read_project", "inspect_status", "edit_code", "publish", "delete_data", "send_message",
]);
/**
 * An admission decision is NOT execution authorization by itself:
 * the executor must independently verify identity, ownership, scope,
 * provider permissions and the specific single-use approval.
 */
export function admitJarvisAction(request: ActionRequest): Admission {
  if (!request || !validActions.has(request.action) ||
      typeof request.resource !== "string" ||
      !request.resource.trim() || request.resource.length > 250)
    return { allowed: false, requiresApproval: false, reason: "invalid_action" };
  if (request.verifiedConnection !== true)
    return { allowed: false, requiresApproval: !readOnly.has(request.action), reason: "connection_unverified" };
  if (!readOnly.has(request.action) && request.approved !== true)
    return { allowed: false, requiresApproval: true, reason: "explicit_approval_required" };
  return { allowed: true, requiresApproval: !readOnly.has(request.action), reason: "admitted_for_executor_validation" };
}
