import "server-only";
export type Network = "youtube"|"instagram"|"tiktok"|"spotify";
export type Metric = "views"|"followers"|"reach"|"engagements"|"watchTimeSeconds";
export type SocialSnapshot = {
  network:Network; accountReference:string; periodStart:string; periodEnd:string;
  values:Partial<Record<Metric,number>>; observedAt:string; source:string;
};
export const socialConnections:Record<Network,{mode:"read_only";authorization:"pending";apiAvailability:"requires_verification";publishEnabled:false}> = {
 youtube:{mode:"read_only",authorization:"pending",apiAvailability:"requires_verification",publishEnabled:false},
 instagram:{mode:"read_only",authorization:"pending",apiAvailability:"requires_verification",publishEnabled:false},
 tiktok:{mode:"read_only",authorization:"pending",apiAvailability:"requires_verification",publishEnabled:false},
 spotify:{mode:"read_only",authorization:"pending",apiAvailability:"requires_verification",publishEnabled:false}
};
export function validateSnapshot(value:unknown):value is SocialSnapshot {
 if(!value||typeof value!=="object")return false;
 const s=value as Record<string,unknown>;
 if(!Object.hasOwn(socialConnections,String(s.network)))return false;
 if(typeof s.accountReference!=="string"||s.accountReference.length>120)return false;
 if(typeof s.source!=="string"||s.source.length>150||!s.source)return false;
 if(![s.periodStart,s.periodEnd,s.observedAt].every(x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}/.test(x)))return false;
 if(!s.values||typeof s.values!=="object"||Array.isArray(s.values))return false;
 return Object.entries(s.values as Record<string,unknown>).every(([k,v])=>
  ["views","followers","reach","engagements","watchTimeSeconds"].includes(k)&&
  typeof v==="number"&&Number.isFinite(v)&&v>=0);
}
export function buildSocialOverview(){
 return Object.entries(socialConnections).map(([network,details])=>({network,...details,connected:false,verified:false}));
}
