import { NextResponse } from "next/server";
import { authorized } from "../../../../lib/auth";
import { runLocalSkill } from "../../../../lib/jarvis-local-skills";
import { CODEX_SKILLS, CODEX_SKILL_SOURCE } from "../../../../lib/cognitive/codex-skill-catalog";
import localSkills from "../../../../config/jarvis-local-skills.json";
import {CODEX_AGENT_ROLES,CODEX_AGENT_SOURCE} from "../../../../lib/cognitive/codex-agent-roles";
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
export async function GET(request:Request){
 if(!(await authorized()))return NextResponse.json({error:"Não autorizado"},{status:401});
 const {discoverSkillTools}=await import("../../../../lib/cognitive/skill-discovery");
 let tooling;
 try{tooling=await discoverSkillTools(new URL(request.url).searchParams.get("verify")==="1",request.signal);}
 catch{return NextResponse.json({error:"SKILL_DISCOVERY_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});}
 return NextResponse.json({
  version:4,
  tooling,
  native:localSkills.skills.map(skill=>({...skill,kind:"local_operation",available:true})),
  engineering:CODEX_SKILLS.map(({id,group,description})=>({
   id,group,description,kind:"contextual_guidance",available:true,
   independentExecution:false
  })),
  engineeringSource:CODEX_SKILL_SOURCE,
  specialistAgents:CODEX_AGENT_ROLES.map(({id,plugin,purpose,sourcePath})=>({id,plugin,purpose,sourcePath,kind:"contextual_agent_role",available:true,independentExecution:false,requiresToolAuthorization:true})),
  agentSource:CODEX_AGENT_SOURCE,
  notes:"Skills e perfis especializados ativos como orientação contextual. Agentes independentes, scanners e mutações exigem executores reais, escopos e aprovação separados."
 },{headers:{"Cache-Control":"no-store"}});
}
