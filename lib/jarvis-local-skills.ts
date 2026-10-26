import "server-only";
import {listProjectMemory,findProjectMemory} from "./kiro-project-memory";
import {continuityChecklist} from "./kiro-continuity";
import {buildCreativePlan} from "./creative-production-engine";
export function runLocalSkill(x:{skill:string;projectId?:string;idea?:string;format?:"short_9_16"|"video_16_9";sceneCount?:number}){
 if(x.skill==="projects.list")return {ok:true,data:listProjectMemory(),externalEffects:false};
 const p=x.projectId?findProjectMemory(x.projectId):null;
 if(!p)return {ok:false,error:"Projeto desconhecido",externalEffects:false};
 if(x.skill==="projects.details")return {ok:true,data:p,externalEffects:false};
 if(x.skill==="creative.continuity")return {ok:true,data:continuityChecklist(p.id),externalEffects:false};
 if(x.skill==="creative.scenes"){
 const data=buildCreativePlan({projectId:p.id,idea:x.idea??"",format:x.format??"short_9_16",sceneCount:x.sceneCount??3});
 return data?{ok:true,data,externalEffects:false}:{ok:false,error:"Rascunho inválido",externalEffects:false};
 }
 return {ok:false,error:"Habilidade não permitida",externalEffects:false};
}
