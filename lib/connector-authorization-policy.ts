import "server-only";
export type ConnectionPhase="planned"|"adapter_prepared"|"awaiting_consent"|"authorized"|"verified"|"revoked"|"error";
export type ServicePermission="profile_read"|"files_read"|"mail_read"|"calendar_read"|"metrics_read"|"write"|"publish"|"execute";
export type ConnectionMetadata={provider:string;phase:ConnectionPhase;scopes:readonly ServicePermission[];verifiedAt:string|null;expiresAt:string|null};
const permittedTransitions:Record<ConnectionPhase,readonly ConnectionPhase[]>={
 planned:["adapter_prepared"],adapter_prepared:["awaiting_consent"],
 awaiting_consent:["authorized","revoked","error"],authorized:["verified","revoked","error"],
 verified:["revoked","error"],revoked:["awaiting_consent"],error:["awaiting_consent","revoked"]
};
export function canAdvanceConnection(from:ConnectionPhase,to:ConnectionPhase){return permittedTransitions[from].includes(to);}
export function canReadProvider(connection:ConnectionMetadata,scope:ServicePermission,now=Date.now()){
 return connection.phase==="verified" && connection.scopes.includes(scope)
  && connection.verifiedAt!==null && (connection.expiresAt===null || Date.parse(connection.expiresAt)>now);
}
export const CONNECTION_GUARDRAILS={
 secretsInBrowser:false,oauthStateRequired:true,pkceRequiredForSupportedOAuth:true,
 encryptedTokenVaultRequired:true,allowUnverifiedAccess:false,
 writesRequirePerActionApproval:true
} as const;
