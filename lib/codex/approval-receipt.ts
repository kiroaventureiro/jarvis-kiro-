import { createHmac, timingSafeEqual } from "node:crypto";

/** Approval receipts can only be issued by a trusted server-side authority. */
export type CodexApprovalReceipt = {
  version: 1;
  taskId: string;
  repository: string;
  branch: string;
  approvedAt: number;
  expiresAt: number;
  taskDigest?: string;
};
function valid(r: CodexApprovalReceipt, now:number) {
  return r?.version===1 &&
    /^[0-9a-f-]{36}$/i.test(r.taskId) &&
    r.repository==="kiroaventureiro/jarvis-kiro-" &&
    r.branch==="feature/diretor-tecnico-agent" &&
    Number.isSafeInteger(r.approvedAt) && Number.isSafeInteger(r.expiresAt) &&
    r.approvedAt<=now && r.expiresAt>now && r.expiresAt-r.approvedAt<=300000 &&
    (r.taskDigest===undefined || /^[a-f0-9]{64}$/.test(r.taskDigest));
}
export function signCodexApproval(r:CodexApprovalReceipt,secret:string,now=Date.now()):string {
  if(secret.length<32 || !valid(r,now)) throw Error("INVALID_APPROVAL");
  return createHmac("sha256",secret).update(JSON.stringify(r)).digest("hex");
}
export function verifyCodexApproval(r:CodexApprovalReceipt,signature:string,secret:string,now=Date.now()):boolean {
  if(secret.length<32 || !valid(r,now) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected=createHmac("sha256",secret).update(JSON.stringify(r)).digest("hex");
  return timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
}
