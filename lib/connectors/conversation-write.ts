import "server-only";
import { randomUUID } from "node:crypto";
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
  const plan=await connectors.plan("Criar "+request.path+" em "+resource.name,[
    {provider:"github",resource:resource.id,operation:"branch",args:{branch,baseSha:sha}},
    {provider:"github",resource:resource.id,operation:"commit",args:{branch,baseSha:sha,path:request.path,content:request.content,message:"feat: adicionar "+request.path}},
    {provider:"github",resource:resource.id,operation:"pull",args:{branch,base:main,title:"Adicionar "+request.path,body:"Alteração solicitada pelo proprietário; revisar antes de merge."}}
  ]);
  return {text:"Preparei o arquivo "+request.path+" no repositório "+resource.name+" com branch, commit e PR em rascunho. Para autorizar, diga: APROVAR "+plan.digest.slice(0,8)+". Nenhuma alteração foi executada ainda.",model:"jk-github",provider:"local_operational" as const,usage:null};
}
