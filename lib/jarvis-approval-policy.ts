import "server-only";
export type ActionCategory="read"|"draft"|"write"|"publish"|"transfer_money"|"delete"|"execute_local";
export type ApprovalDecision={allowed:boolean;requiresApproval:boolean;reason:string};
export function assessAction(category:ActionCategory,hasLiveAuthorization=false,hasOneTimeApproval=false):ApprovalDecision{
 if(category==="read")return hasLiveAuthorization
  ? {allowed:true,requiresApproval:false,reason:"Somente leitura autorizada"}
  : {allowed:false,requiresApproval:false,reason:"Conector não autorizado"};
 if(category==="draft")return {allowed:true,requiresApproval:false,reason:"Rascunho local sem efeitos externos"};
 return {allowed:false,requiresApproval:true,
  reason:hasOneTimeApproval?"Aprovação apresentada, porém execução desabilitada até auditoria e integração reais":"Aprovação específica obrigatória; execução desabilitada"};
}
