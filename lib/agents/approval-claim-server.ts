import "server-only";
import type { JarvisAction } from "./action-admission";

/** Server-only adapter. Caller must derive all inputs from an authenticated session. */
export type TrustedApprovalClaim = {
  approvalId: string;
  ownerId: string;
  action: JarvisAction;
  resource: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(["edit_code", "publish", "delete_data", "send_message"]);
export async function claimJarvisApproval(
  claim: TrustedApprovalClaim,
  authorizedOwnerId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!claim || !uuid.test(claim.approvalId) || !/^[A-Za-z0-9_-]{1,80}$/.test(authorizedOwnerId) ||
      claim.ownerId !== authorizedOwnerId || !actions.has(claim.action) ||
      typeof claim.resource !== "string" || !claim.resource.trim() || claim.resource.length > 250)
    return false;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Error("APPROVAL_STORAGE_NOT_CONFIGURED");
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.port || endpoint.pathname !== "/" || endpoint.search || endpoint.hash ||
      !/^[a-z0-9-]+\.supabase\.co$/i.test(endpoint.hostname))
    throw Error("INVALID_APPROVAL_ENDPOINT");
  const result = await fetch(endpoint.origin + "/rest/v1/rpc/jarvis_claim_approval", {
    method: "POST", redirect: "error", cache: "no-store",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_id: claim.approvalId, p_owner_id: authorizedOwnerId,
      p_action: claim.action, p_resource_id: claim.resource,
    }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(8000),
  });
  if (!result.ok) throw Error("APPROVAL_CLAIM_UNAVAILABLE");
  const data: unknown = await result.json();
  if (typeof data !== "boolean") throw Error("INVALID_APPROVAL_RESPONSE");
  return data;
}
