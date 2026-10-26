import "server-only";
import registry from "../config/kiro-project-registry.json";
import rules from "../config/kiro-continuity-rules.json";
export type CreativeFormat="short_9_16"|"video_16_9";
export type CreativeRequest={projectId:string;idea:string;format:CreativeFormat;sceneCount:number};
export type CreativePlan={stage:"draft_only";projectId:string;projectName:string;format:CreativeFormat;
 scenes:{number:number;objective:string;visualPrompt:string}[];continuityRules:string[];
 reviewRequired:true;externalGenerationExecuted:false;publicationEnabled:false};
export function buildCreativePlan(input:CreativeRequest):CreativePlan|null{
 const project=registry.projects.find(p=>p.id===input.projectId);
 if(!project||!["short_9_16","video_16_9"].includes(input.format)||
 !Number.isInteger(input.sceneCount)||input.sceneCount<1||input.sceneCount>12||
 typeof input.idea!=="string"||input.idea.trim().length<5||input.idea.length>500)return null;
 const projectRules=rules.rules.filter(r=>r.project===input.projectId);
 const continuityRules=projectRules.map(r=>r.description);
 return {stage:"draft_only",projectId:project.id,projectName:project.name,format:input.format,
  scenes:Array.from({length:input.sceneCount},(_,i)=>({number:i+1,
   objective:i===0?"Apresentar a situação":i===input.sceneCount-1?"Concluir a sequência":"Desenvolver a ação",
   visualPrompt:[input.idea.trim(),`Cena ${i+1} de ${input.sceneCount}`,`Formato ${input.format}`,
    `Elenco autorizado: ${project.characters.join(", ")||"definir conforme projeto"}`,
    ...continuityRules].join(". ")})),
  continuityRules,reviewRequired:true,externalGenerationExecuted:false,publicationEnabled:false};
}
