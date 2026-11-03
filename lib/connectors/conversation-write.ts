import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cookieName } from "../auth";
import { hash } from "./security";
import { connectors, connectorStore } from "./server";
import { requestedProject, selectProjectResources } from "./project-selection";
import { parseGitHubWriteIntent } from "./write-intent";
export async function prepareGitHubWrite(message:string, history:Array<{role:string;content:string}>=[]) {
  const previous=history.slice(-8).reverse().find(t=>t.role==="user"&&/github|git hub|jarvis kiro|repositori|projeto/i.test(t.content));
  const contextual=previous?.content||"";
  const request=parseGitHubWriteIntent(message,contextual);
  if(!request)return null;
  const state=await connectorStore.read();
  const account=state.connections.github;
  const reply=(text:string)=>({text,model:"jk-github",provider:"local_operational" as const,usage:null});
  if(!account?.verifiedAt||account.status!=="connected"||!account.grants.includes("write"))
    return reply("GitHub conectado para leitura, mas a permissão de escrita ainda não está validada. Nenhum arquivo foi alterado.");
  const selection=requestedProject(message,account.resources);
  let resources=selectProjectResources(selection,account.resources);
  if(resources.length!==1 && contextual){
    const priorSelection=requestedProject(contextual,account.resources);
    if(priorSelection.kind==="target")resources=selectProjectResources(priorSelection,account.resources);
  }
  // Speech recognition can omit hyphens or trailing punctuation in repo names.
  // Use only a unique, exact alias among the provider-authorized repositories.
  if(resources.length!==1) {
    const fold=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
    const said=fold(message);
    const aliases=[
      {alias:"jarviskiro",repo:"jarviskiro"},
      {alias:"javaskiro",repo:"jarviskiro"},
      {alias:"jarvisquiro",repo:"jarviskiro"},
    ];
    const requested=aliases.filter(x=>said.includes(x.alias)).map(x=>x.repo);
    if(requested.length===1){
      const matches=account.resources.filter(r=>fold(r.name.split("/").at(-1)||"")===requested[0]);
      if(matches.length===1)resources=matches;
    }
  }
  if(resources.length!==1)
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
  const ownerCookie=(await cookies()).get(cookieName)?.value;
  if(!ownerCookie) return reply("Sua sessão expirou. A proposta não pode ser autorizada; nenhuma alteração foi executada.");
  await connectorStore.update(state=>{
    const saved=state.plans.find(p=>p.id===plan.id);
    if(saved && saved.status==="draft") saved.conversationSession=hash(ownerCookie);
  });
  return {text:"Preparei "+(request.kind==="create_folder"?"a pasta "+request.path.slice(0,-9)+" (com arquivo .gitkeep para registrá-la no GitHub)":"o arquivo "+request.path)+" no repositório "+resource.name+" com branch, commit e PR em rascunho. Para autorizar, diga: APROVAR "+plan.digest.slice(0,8)+". Nenhuma alteração foi executada ainda.",model:"jk-github",provider:"local_operational" as const,usage:null};
}

export async function approveGitHubWrite(message:string, history:Array<{role:string;content:string}>=[]) {
  const match=/^(?:jarvis[,!:.]?\s*)?aprovar\s+([a-f0-9]{8})[.!\s]*$/i.exec(message.trim());
  const plain=/^(?:(?:sim|eu)[,!.]?\s*)?(?:aprovo|autorizo|confirmo|pode executar|pode criar|pode fazer|pode prosseguir|esta aprovado|está aprovado|aprovado)[.! ]*$/i.test(message.trim());
  if(!match&&!plain)return null;
  const reply=(text:string)=>({text,model:"jk-github",provider:"local_operational" as const,usage:null});
  const prior=history.slice(-6).reverse().find(turn=>turn.role==="assistant"&&/\bAPROVAR\s+[a-f0-9]{8}\b/i.test(turn.content));
  const previousCode=/\bAPROVAR\s+([a-f0-9]{8})\b/i.exec(prior?.content||"")?.[1];
  const session=(await cookies()).get(cookieName)?.value;
  if(!session)return reply("Sessão do proprietário ausente. Nenhuma alteração foi executada.");
  const sessionId=hash(session);
  const state=await connectorStore.read();
  const digestCode=match?.[1]?.toLowerCase() || (plain ? previousCode?.toLowerCase() : undefined);
  const pending=state.plans.filter(p=>
    p.status==="draft" &&
    p.conversationSession===sessionId &&
    p.expiresAt>Date.now() &&
    p.createdAt>Date.now()-300000 &&
    p.steps.every(step=>step.action.provider==="github")
  );
  const matches=digestCode?pending.filter(p=>p.digest.startsWith(digestCode)):plain?pending:[];
  if(matches.length!==1)
    return reply("Não encontrei uma única proposta recente de escrita autorizável nesta sessão. Nenhuma alteração foi executada.");
  const plan=matches[0];
  await connectors.approve(plan.id,plan.digest,"APROVAR "+plan.digest.slice(0,8),sessionId);
  const completed=await connectors.execute(plan.id,plan.digest,sessionId);
  const pr=completed.steps.find(step=>step.action.operation==="pull")?.result as {url?:string}|undefined;
  return reply("Execução GitHub: "+completed.status+"."+(pr?.url?" Pull request: "+pr.url:"")+
    (completed.status==="waiting"?" O plano ainda está em andamento.":""));
}
