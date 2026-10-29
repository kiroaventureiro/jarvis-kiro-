/** Approval challenge for a future Codex executor. A phrase alone never starts work. */
export type CodexApprovalChallenge={
 taskId:string;
 repository:string;
 branch:string;
 action:"review"|"test"|"implement";
 nonce:string;
 expiresAt:number;
};
export function validateCodexApprovalChallenge(
 challenge:CodexApprovalChallenge,
 record:{id:string;repository:string;branch:string;kind?:string;state:string},
 now:number,
):boolean {
 if(record.state!=="draft"||challenge.taskId!==record.id||challenge.repository!==record.repository||
    challenge.branch!==record.branch||challenge.action!==record.kind)return false;
 if(!/^[0-9a-f-]{36}$/i.test(challenge.taskId)||
    !/^[a-zA-Z0-9_-]{24,128}$/.test(challenge.nonce))return false;
 if(!Number.isFinite(challenge.expiresAt)||challenge.expiresAt<=now||
    challenge.expiresAt>now+300000)return false;
 return true;
}
export const CODEX_APPROVAL_RULES={
 mustBindTask:true,
 mustBindRepository:true,
 mustBindBranch:true,
 mustExpire:true,
 requiresVerifiedReceipt:true,
 allowsImmediateExecution:false,
} as const;
