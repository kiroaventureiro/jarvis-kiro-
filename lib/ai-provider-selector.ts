import "server-only";
import policy from "../config/ai-provider-routing.json";
export type AIMode="chat"|"voice"|"code"|"research"|"images"|"video"|"audio"|"music"|"design";
export type ProviderCandidate={id:string;name:string;costClass:string;connection:string;eligible:boolean;reason:string};
export function planAIProviders(mode:AIMode):{mode:AIMode;execution:false;ranked:ProviderCandidate[]}{
 const matches=policy.providers.filter(p=>(p.modes as string[]).includes(mode));
 const ranked=matches.map(p=>({
  id:p.id,name:p.name,costClass:p.costClass,connection:p.connection,
  eligible:false,reason:p.costClass==="potentially_free"?"Disponibilidade e gratuidade ainda não verificadas":
   "Necessita autorização e verificação de custo/capacidade antes de qualquer chamada"
 }));
 ranked.sort((a,b)=>Number(b.costClass==="potentially_free")-Number(a.costClass==="potentially_free"));
 return {mode,execution:false,ranked};
}
