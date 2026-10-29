import "server-only";
import registry from "../config/kiro-project-registry.json";
export function listProjectMemory(){return registry.projects.map(p=>({
 id:p.id,name:p.name,context:p.context,topics:p.topics,characters:p.characters,
 provenance:p.sources,syncStatus:"not_connected",liveVerification:false
}));}
export function findProjectMemory(id:string){
 return listProjectMemory().find(p=>p.id===id)??null;
}
export const PROJECT_MEMORY_POLICY={writeToExternalServices:false,storeSecrets:false,
 autoLearnFromPrivateAccounts:false,requiresFreshSourceForChanges:true} as const;
