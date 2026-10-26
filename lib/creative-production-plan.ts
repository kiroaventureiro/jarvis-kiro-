import "server-only";
import { continuityChecklist } from "./kiro-continuity";
import { findProjectMemory } from "./kiro-project-memory";
export type CreativeFormat="short_9_16"|"landscape_16_9";
export type CreativeProvider="grok"|"openart"|"invideo"|"capcut"|"suno";
export type CreativeRequest={project:string;title:string;format:CreativeFormat;provider:CreativeProvider;brief:string};
export function buildCreativeProductionPlan(request:CreativeRequest){
 const project=findProjectMemory(request.project);
 if(!project)return {valid:false,reason:"Projeto não encontrado",generationEnabled:false};
 const checklist=continuityChecklist(request.project);
 return {valid:true,project:project.name,title:request.title,format:request.format,provider:request.provider,
 brief:request.brief,stages:["roteiro","divisão_em_cenas","revisão_de_continuidade","prompts","aprovação_editorial"],
 continuity:checklist,requiresApproval:true,generationEnabled:false,externalRequestSent:false,
 note:"Plano de produção apenas; nenhuma geração externa foi acionada."};
}
