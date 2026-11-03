import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { runLocalSkill } from "../../../../lib/jarvis-local-skills";
import { CODEX_SKILLS, CODEX_SKILL_SOURCE } from "../../../../lib/cognitive/codex-skill-catalog";
import localSkills from "../../../../config/jarvis-local-skills.json";
export const dynamic="force-dynamic";
export async function POST(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 let body:unknown;
 try{body=await request.json()}catch{return NextResponse.json({error:"JSON inválido"},{status:400})}
 if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Dados inválidos"},{status:400});
 const x=body as Record<string,unknown>;
 if(typeof x.skill!=="string"||x.skill.length>40||
 (x.projectId!==undefined&&(typeof x.projectId!=="string"||x.projectId.length>60))||
 (x.idea!==undefined&&(typeof x.idea!=="string"||x.idea.length>1500))||
 (x.format!==undefined&&!["short_9_16","video_16_9"].includes(String(x.format)))||
 (x.sceneCount!==undefined&&(!Number.isInteger(x.sceneCount)||Number(x.sceneCount)<1||Number(x.sceneCount)>12)))
 return NextResponse.json({error:"Parâmetros inválidos"},{status:400});
 const result=runLocalSkill(x as Parameters<typeof runLocalSkill>[0]);
 return NextResponse.json(result,{status:result.ok?200:400,headers:{"Cache-Control":"no-store"}});
}

/** Authenticated inventory. The 20 Codex-derived skills are contextual
 * engineering guidance, not executable server operations or remote agents.
 */
export async function GET(){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 return NextResponse.json({
  version:2,
  native:localSkills.skills.map(skill=>({...skill,kind:"local_operation",available:true})),
  engineering:CODEX_SKILLS.map(({id,group,description})=>({
   id,group,description,kind:"contextual_guidance",available:true,
   independentExecution:false
  })),
  engineeringSource:CODEX_SKILL_SOURCE,
  notes:"Orientação contextual ativa; execução depende de conectores e permissões, não é um scanner ou agente independente."
 },{headers:{"Cache-Control":"no-store"}});
}
