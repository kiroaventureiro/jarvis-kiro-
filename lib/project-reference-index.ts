import "server-only";
export type ReferenceProvider="github"|"google_drive"|"onedrive"|"chatgpt_import"|"local_agent";
export type ReferenceContext="personal"|"kiro";
export type ProjectReference={id:string;provider:ReferenceProvider;context:ReferenceContext;project:string;
 externalId:string;displayTitle:string;updatedAt:string|null;sourceUrl:string|null;classification:"ordinary"|"confidential"};
export function normalizeReference(ref:ProjectReference){
 return {id:ref.id,provider:ref.provider,context:ref.context,project:ref.project,
 externalId:ref.externalId,displayTitle:ref.displayTitle,updatedAt:ref.updatedAt,
 sourceUrl:ref.sourceUrl,classification:ref.classification};
}
export function filterReferences(records:readonly ProjectReference[],context:ReferenceContext,query:string,limit=10){
 const q=query.trim().toLocaleLowerCase("pt-BR");
 if(q.length<3||q.length>100)return [];
 return records.filter(r=>r.context===context&&r.classification==="ordinary"&&
 [r.project,r.displayTitle].join(" ").toLocaleLowerCase("pt-BR").includes(q)).slice(0,Math.min(Math.max(limit,1),20));
}
export const INDEX_POLICY={storeDocumentBodies:false,storeEmailBodies:false,storeCredentials:false,
 allowCrossContextSearch:false,requireProviderAuthorization:true,persistentIndexConfigured:false} as const;
