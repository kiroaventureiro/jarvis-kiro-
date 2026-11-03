import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cookieName } from "../auth";
import { hash } from "./security";
import { connectors, connectorStore } from "./server";
import { requestedProject, selectProjectResources } from "./project-selection";
import { parseGitHubWriteIntent } from "./write-intent";
export async function prepareGitHubWrite(message:string) {
  const request=parseGitHubWriteIntent(message);
  if(!request)return null;
  const state=await connectorStore.read();
  const account=state.connections.github;
  const reply=(text:string)=>({text,model:"jk-github",provider:"local_operational" as const,usage:null});
  if(!account?.verifiedAt||account.status!=="connected"||!account.grants.includes("write"))
    return reply("GitHub conectado para leitura, mas a permissão de escrita ainda não está validada. Nenhum arquivo foi alterado.");
  const selection=requestedProject(message,account.resources);
  const resources=selectProjectResources(selection,account.resources);
  if(selection.kind!=="target"||resources.length!==1)
    return reply("Não identifiquei um único repositório autorizado para a alteração. Nenhuma escrita foi realizada.");
  const resource=resources[0];
  const repo=await connectors.readAuthorized("github",resource.id,"repo");
  const commits=await connectors.readAuthorized("github",resource.id,"commits");
  const main=(repo.data as {defaultBranch?:string}).defaultBranch;
  const sha=(commits.data as Array<{sha?:string}>)[0]?.sha;
  if(!main||!sha) return reply("Não foi possível confirmar a branch principal e o commit base.");
  const branch="jk/arquivo-"+randomUUID().slice(0,8);
  const description=request.kind==="create_folder"?"Criar a pasta "+request.path.slice(0,-9):"Criar o arquivo "+request.path;
  const plan=await connectors.plan(description+" em "+resource.name,[
    {provider:"github",resource:resource.id,operation:"branch",args:{branch,baseSha:sha}},
    {provider:"github",resource:resource.id,operation:"commit",args:{branch,baseSha:sha,path:request.path,content:request.content,message:"feat: "+(request.kind==="create_folder"?"criar pasta ":"adicionar arquivo ")+(request.kind==="create_folder"?request.path.slice(0,-9):request.path)}},
    {provider:"github",resource:resource.id,operation:"pull",args:{branch,base:main,title:description,body:"Alteração solicitada pelo proprietário; revisar antes de merge."}}
  ]);
  return {text:"Preparei "+(request.kind==="create_folder"?"a pasta "+request.path.slice(0,-9)+" (com arquivo .gitkeep para registrá-la no GitHub)":"o arquivo "+request.path)+" no repositório "+resource.name+" com branch, commit e PR em rascunho. Para autorizar, diga: APROVAR "+plan.digest.slice(0,8)+". Nenhuma alteração foi executada ainda.",model:"jk-github",provider:"local_operational" as const,usage:null};
}

export async function approveGitHubWrite(message:string, history:Array<{role:string;content:string}>=[]) {
  const match=/^(?:jarvis[,!:.]?\s*)?aprovar\s+([a-f0-9]{8})[.!\s]*$/i.exec(message.trim());
  const plain=/^(?:sim[,!.]?\s*)?(?:aprovo|autorizo|confirmo|pode executar|pode criar)[.! ]*$/i.test(message.trim());
  if(!match&&!plain)return null;
  const reply=(text:string)=>({text,model:"jk-github",provider:"local_operational" as const,usage:null});
  const session=(await cookies()).get(cookieName)?.value;
  if(!session)return reply("Sessão do proprietário ausente. Nada foi executado.");
  const state=await connectorStore.read();
  const matches=state.plans.filter(p=>p.digest.startsWith(match[1].toLowerCase())&&p.status==="draft"&&p.expiresAt>Date.now());
  if(matches.length!==1)return reply("Não encontrei uma proposta única e válida. Nada foi executado.");
  const plan=matches[0];
  if(plan.steps.some(step=>step.action.provider!=="github"))
    return reply("Este plano inclui outras plataformas e precisa de aprovação separada.");
  const sessionId=hash(session);
  await connectors.approve(plan.id,plan.digest,"APROVAR "+match[1].toLowerCase(),sessionId);
  const completed=await connectors.execute(plan.id,plan.digest,sessionId);
  const pr=completed.steps.find(step=>step.action.operation==="pull")?.result as {url?:string}|undefined;
  return reply("Execução GitHub: "+completed.status+"."+(pr?.url?" Pull request: "+pr.url:"")+
    (completed.status==="waiting"?" O plano ainda está em andamento.":""));
}
