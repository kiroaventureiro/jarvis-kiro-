import "server-only";
import { randomBytes, createHash } from "node:crypto";
import type { StateStore } from "./types";
import { readJsonBounded } from "../abacus/hub";
export const WORKSPACE_SERVICES = [
  {id:"gmail",provider:"google",name:"Gmail",scope:"https://www.googleapis.com/auth/gmail.metadata",url:"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",key:"messages"},
  {id:"google-drive",provider:"google",name:"Drive · Docs · Sheets · Slides",scope:"https://www.googleapis.com/auth/drive.metadata.readonly",url:"https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name,mimeType)",key:"files"},
  {id:"google-calendar",provider:"google",name:"Google Agenda",scope:"https://www.googleapis.com/auth/calendar.calendarlist.readonly",url:"https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=5",key:"items"},
  {id:"google-contacts",provider:"google",name:"Google Contatos",scope:"https://www.googleapis.com/auth/contacts.readonly",url:"https://people.googleapis.com/v1/people/me/connections?personFields=names&pageSize=5",key:"connections"},
  {id:"youtube",provider:"google",name:"YouTube · Kiro TV",scope:"https://www.googleapis.com/auth/youtube.readonly",url:"https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=5",key:"items"},
  {id:"google-tasks",provider:"google",name:"Google Tasks · listas",scope:"https://www.googleapis.com/auth/tasks.readonly",url:"https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=5",key:"items"},
  {id:"google-forms",provider:"google",name:"Google Forms · arquivos",scope:"https://www.googleapis.com/auth/drive.metadata.readonly",url:"https://www.googleapis.com/drive/v3/files?pageSize=5&fields=files(id,name,mimeType)&q=mimeType%3D%27application%2Fvnd.google-apps.form%27%20and%20trashed%3Dfalse",key:"files"},
  {id:"google-meet",provider:"google",name:"Google Meet · registros de reuniões",scope:"https://www.googleapis.com/auth/meetings.space.readonly",url:"https://meet.googleapis.com/v2/conferenceRecords?pageSize=5",key:"conferenceRecords"},
  {id:"outlook",provider:"microsoft",name:"Outlook · e-mail",scope:"Mail.ReadBasic",url:"https://graph.microsoft.com/v1.0/me/messages?$top=5&$select=id,subject",key:"value"},
  {id:"microsoft-calendar",provider:"microsoft",name:"Microsoft Agenda",scope:"Calendars.ReadBasic",url:"https://graph.microsoft.com/v1.0/me/calendars?$top=5&$select=id,name",key:"value"},
  {id:"onedrive",provider:"microsoft",name:"OneDrive · Word · Excel · PowerPoint",scope:"Files.Read",url:"https://graph.microsoft.com/v1.0/me/drive/root/children?$top=5&$select=id,name",key:"value"},
  {id:"microsoft-contacts",provider:"microsoft",name:"Microsoft Contatos",scope:"Contacts.Read",url:"https://graph.microsoft.com/v1.0/me/contacts?$top=5&$select=id,displayName",key:"value"},
  {id:"microsoft-todo",provider:"microsoft",name:"Microsoft To Do · listas",scope:"Tasks.Read",url:"https://graph.microsoft.com/v1.0/me/todo/lists?$top=5&$select=id,displayName",key:"value"},
  {id:"microsoft-teams",provider:"microsoft",name:"Teams · equipes (conta corporativa/escolar)",scope:"Team.ReadBasic.All",url:"https://graph.microsoft.com/v1.0/me/joinedTeams",key:"value"},
  {id:"sharepoint",provider:"microsoft",name:"SharePoint · sites seguidos (conta corporativa/escolar)",scope:"Sites.Read.All",url:"https://graph.microsoft.com/v1.0/me/followedSites?$select=id,displayName",key:"value"},
] as const;
export type WorkspaceProvider="google"|"microsoft";
type Pending={provider:WorkspaceProvider;services:string[];verifier:string;bindingHash:string;expiresAt:number;sessionExpires:number;epoch:number};
type Account={id:string;provider:WorkspaceProvider;accessToken:string;refreshToken?:string;expiresAt:number;services:string[];verifiedAt:Record<string,string>;refreshLease?:string;refreshLeaseAt?:number};
export type WorkspaceState={workspaceEpoch?:Partial<Record<WorkspaceProvider,number>>;workspacePending?:Record<string,Pending>;workspaceAccounts?:Partial<Record<WorkspaceProvider,Account>>};
const digest=(s:string)=>createHash("sha256").update(s).digest("hex");
const providerValid=(p:string):p is WorkspaceProvider=>p==="google"||p==="microsoft";
function workspaceOrigin(env:NodeJS.ProcessEnv){
 const raw=env.JARVIS_CONNECTOR_ORIGIN||"";
 let origin="";try{const u=new URL(raw);if(u.href===u.origin+"/"&&(u.protocol==="https:"||(u.protocol==="http:"&&u.hostname==="localhost")))origin=u.origin;}catch{}
 return origin;
}
function config(p:WorkspaceProvider,env:NodeJS.ProcessEnv){
 const origin=workspaceOrigin(env);
 const prefix=p==="google"?"GOOGLE":"MICROSOFT";
 const id=env[prefix+"_CLIENT_ID"],secret=env[prefix+"_CLIENT_SECRET"];
 return origin&&id&&secret?{origin,id,secret}:null;
}
function selections(p:WorkspaceProvider,input:unknown){
 if(!Array.isArray(input)||!input.length||input.length>9||!input.every(x=>typeof x==="string"&&WORKSPACE_SERVICES.some(s=>s.id===x&&s.provider===p)))throw Error("INVALID_SERVICES");
 return [...new Set(input as string[])];
}
export class WorkspaceConnectors {
 constructor(private store:StateStore,private env:NodeJS.ProcessEnv,private fetcher:typeof fetch=fetch,private now=Date.now){}
 private endpoints(p:WorkspaceProvider){return p==="google"?{auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token"}:{auth:"https://login.microsoftonline.com/common/oauth2/v2.0/authorize",token:"https://login.microsoftonline.com/common/oauth2/v2.0/token"};}
 private callback(p:WorkspaceProvider){const c=config(p,this.env);if(!c)throw Error("WORKSPACE_APP_NOT_CONFIGURED");return c.origin+"/api/director/workspace-connectors/"+p+"/callback";}
 async overview(){
  const configured=this.store.configured();const s=configured?await this.store.read():null;
  return {providers:(["google","microsoft"] as const).map(provider=>{
   const a=s?.workspaceAccounts?.[provider];
   return {provider,authorizationReady:configured&&!!config(provider,this.env),
    missing:[...(!configured?["cofre de conectores"]:[]),...(!workspaceOrigin(this.env)?["JARVIS_CONNECTOR_ORIGIN válido"]:[]),...["CLIENT_ID","CLIENT_SECRET"].filter(key=>!this.env[(provider==="google"?"GOOGLE_":"MICROSOFT_")+key]).map(key=>(provider==="google"?"GOOGLE_":"MICROSOFT_")+key)],
    connected:!!a,services:a?.services||[],verifiedAt:a?.verifiedAt||{},callback:workspaceOrigin(this.env)?workspaceOrigin(this.env)+"/api/director/workspace-connectors/"+provider+"/callback":null};
  }),services:WORKSPACE_SERVICES.map(({id,provider,name,scope})=>({id,provider,name,scope})),mode:"read_metadata_only",writesEnabled:false};
 }
 async start(provider:string,input:unknown,sessionExpires:number){
  if(!providerValid(provider)||!Number.isFinite(sessionExpires)||sessionExpires<=this.now())throw Error("INVALID_PROVIDER_OR_SESSION");
  const p=provider,c=config(p,this.env);if(!c||!this.store.configured())throw Error("WORKSPACE_APP_NOT_CONFIGURED");
  const services=selections(p,input),state=randomBytes(32).toString("base64url"),binding=randomBytes(32).toString("base64url"),verifier=randomBytes(48).toString("base64url");
  await this.store.update(s=>{
   const records=s.workspacePending||(s.workspacePending={});
   for(const [k,v] of Object.entries(records))if(v.expiresAt<=this.now())delete records[k];
   if(Object.keys(records).length>=20)throw Error("PENDING_LIMIT");
   records[digest(state)]={provider:p,services,verifier,bindingHash:digest(binding),expiresAt:this.now()+600000,sessionExpires,epoch:s.workspaceEpoch?.[p]||0};
  });
  const url=new URL(this.endpoints(p).auth);
  const scopes:string[]=[...new Set(WORKSPACE_SERVICES.filter(s=>services.includes(s.id)).map(s=>s.scope))];
  if(p==="microsoft")scopes.push("offline_access");
  for(const [k,v] of Object.entries({client_id:c.id,redirect_uri:this.callback(p),response_type:"code",scope:scopes.join(" "),state,code_challenge:Buffer.from(digest(verifier),"hex").toString("base64url"),code_challenge_method:"S256"}))url.searchParams.set(k,v);
  if(p==="google"){url.searchParams.set("access_type","offline");url.searchParams.set("prompt","consent");}
  return {authorizationUrl:url.href,binding};
 }
 private async token(p:WorkspaceProvider,params:Record<string,string>){
  const c=config(p,this.env);if(!c)throw Error("WORKSPACE_APP_NOT_CONFIGURED");
  const response=await this.fetcher(this.endpoints(p).token,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({...params,client_id:c.id,client_secret:c.secret})});
  const data=await readJsonBounded(response,65536) as Record<string,unknown>;
  if(typeof data.access_token!=="string"||!data.access_token||data.access_token.length>20000||typeof data.expires_in!=="number"||!Number.isFinite(data.expires_in)||data.expires_in<=0||data.expires_in>86400|| (data.refresh_token!==undefined&&(typeof data.refresh_token!=="string"||data.refresh_token.length>20000)))throw Error("INVALID_TOKEN_RESPONSE");
  return {accessToken:data.access_token,refreshToken:data.refresh_token as string|undefined,expiresAt:this.now()+data.expires_in*1000};
 }
 async finish(provider:string,state:string,binding:string,code:string){
  if(!providerValid(provider)||!/^[\w-]{43}$/.test(state)||!/^[\w-]{43}$/.test(binding)||!code||code.length>4096)throw Error("INVALID_CALLBACK");
  const pending=await this.store.update(s=>{
   const record=s.workspacePending?.[digest(state)];
   if(!record||record.provider!==provider||record.bindingHash!==digest(binding)||record.expiresAt<=this.now()||record.sessionExpires<=this.now())throw Error("INVALID_CALLBACK");
   delete s.workspacePending![digest(state)];return record;
  });
  const tokens=await this.token(provider,{grant_type:"authorization_code",code,code_verifier:pending.verifier,redirect_uri:this.callback(provider)});
  const account:Account={id:randomBytes(16).toString("hex"),provider,...tokens,services:pending.services,verifiedAt:{}};
  await this.store.update(s=>{if((s.workspaceEpoch?.[provider]||0)!==pending.epoch)throw Error("WORKSPACE_NOT_CONNECTED");(s.workspaceAccounts||(s.workspaceAccounts={}))[provider]=account;s.audit.push({id:randomBytes(12).toString("hex"),at:new Date(this.now()).toISOString(),operation:"workspace.authorized",resource:provider,outcome:"saved"});});
 }
 private async account(p:WorkspaceProvider){
  const account=(await this.store.read()).workspaceAccounts?.[p];if(!account)throw Error("WORKSPACE_NOT_CONNECTED");
  if(account.expiresAt>this.now()+30000)return account;
  if(!account.refreshToken)throw Error("WORKSPACE_REAUTHORIZE");
  const lease=randomBytes(16).toString("hex");
  await this.store.update(s=>{const a=s.workspaceAccounts?.[p];if(!a||a.id!==account.id||(a.refreshLease&&this.now()-(a.refreshLeaseAt||0)<30000))throw Error("WORKSPACE_REFRESH_BUSY");a.refreshLease=lease;a.refreshLeaseAt=this.now();});
  try{
   const tokens=await this.token(p,{grant_type:"refresh_token",refresh_token:account.refreshToken});
   return await this.store.update(s=>{const a=s.workspaceAccounts?.[p];if(!a||a.id!==account.id||a.refreshLease!==lease)throw Error("WORKSPACE_NOT_CONNECTED");Object.assign(a,tokens,{refreshToken:tokens.refreshToken||a.refreshToken});delete a.refreshLease;delete a.refreshLeaseAt;return a;});
  }catch{await this.store.update(s=>{const a=s.workspaceAccounts?.[p];if(a?.refreshLease===lease){delete a.refreshLease;delete a.refreshLeaseAt;}});throw Error("WORKSPACE_REAUTHORIZE");}
 }
 async read(serviceId:string){
  const service=WORKSPACE_SERVICES.find(s=>s.id===serviceId);if(!service)throw Error("INVALID_SERVICE");
  const account=await this.account(service.provider);if(!account.services.includes(service.id))throw Error("WORKSPACE_SCOPE_REQUIRED");
  // Destination and fields are fixed by the implemented adapter; no arbitrary URL or tool execution.
  const response=await this.fetcher(service.url,{method:"GET",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),headers:{Authorization:"Bearer "+account.accessToken}});
  let data:Record<string,unknown>;
  try{data=await readJsonBounded(response,131072) as Record<string,unknown>;}catch{await this.store.update(s=>{const a=s.workspaceAccounts?.[service.provider];if(a?.id===account.id)delete a.verifiedAt[serviceId];});throw Error("WORKSPACE_READ_FAILED");}
  const rows=data[service.key]||[];if(!Array.isArray(rows))throw Error("WORKSPACE_INVALID_RESPONSE");
  const safe=(v:unknown)=>typeof v==="string"?v.replace(/[\x00-\x1f<>]/g," ").slice(0,180):"";
  const metadata=service.id==="gmail"?await Promise.all(rows.slice(0,5).map(async v=>{
    const id=v&&typeof v==="object"?(v as Record<string,unknown>).id:null;
    if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw Error("WORKSPACE_INVALID_RESPONSE");
    const r=await this.fetcher("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(id)+"?format=metadata&metadataHeaders=Subject&fields=id,payload(headers)",{method:"GET",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),headers:{Authorization:"Bearer "+account.accessToken}});
    const detail=await readJsonBounded(r,65536) as {payload?:{headers?:Array<{name?:string;value?:string}>}};
    return {id,subject:detail.payload?.headers?.find(h=>h.name?.toLowerCase()==="subject")?.value};
  })):rows.slice(0,5);
  const items=metadata.map(v=>{const r=v&&typeof v==="object"?v as Record<string,unknown>:{};const snippet=r.snippet as Record<string,unknown>|undefined;const firstName=Array.isArray(r.names)?r.names[0] as Record<string,unknown>|undefined:undefined;return {id:safe(r.id||r.resourceName),name:safe(r.name||r.title||r.summary||r.subject||r.displayName||firstName?.displayName||snippet?.title)||safe(r.id)||"Registro autorizado"};});
  const checkedAt=new Date(this.now()).toISOString();
  await this.store.update(s=>{const a=s.workspaceAccounts?.[service.provider];if(!a||a.id!==account.id)throw Error("WORKSPACE_NOT_CONNECTED");a.verifiedAt[serviceId]=checkedAt;s.audit.push({id:randomBytes(12).toString("hex"),at:checkedAt,operation:"workspace.metadata_read",resource:serviceId,outcome:"verified"});});
  return {service:serviceId,checkedAt,items,source:"live",untrusted:true,scope:"metadata",writesEnabled:false};
 }
 async disconnect(provider:string){
  if(!providerValid(provider))throw Error("INVALID_PROVIDER");
  await this.store.update(s=>{const epochs=s.workspaceEpoch||(s.workspaceEpoch={});epochs[provider]=(epochs[provider]||0)+1;delete s.workspaceAccounts?.[provider];for(const [k,v]of Object.entries(s.workspacePending||{}))if(v.provider===provider)delete s.workspacePending![k];s.audit.push({id:randomBytes(12).toString("hex"),at:new Date(this.now()).toISOString(),operation:"workspace.disconnect",resource:provider,outcome:"removed_locally"});});
  return {disconnected:true,remoteRevoked:false};
 }
}

/** Route only explicit account metadata requests; no model-generated tools. */
export function workspaceReadIntent(message:string){
 const n=message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const service=/\bgoogle\b/.test(n)&&/tarefas|tasks/.test(n)?"google-tasks":(/\bforms\b/.test(n)||/\bgoogle\b/.test(n)&&/formularios/.test(n))?"google-forms":/\bmeet\b/.test(n)?"google-meet":(/\b(to do|todo)\b/.test(n)||/\bmicrosoft\b/.test(n)&&/tarefas/.test(n))?"microsoft-todo":/\bteams\b/.test(n)?"microsoft-teams":/\bsharepoint\b/.test(n)?"sharepoint":/\bgmail\b/.test(n)?"gmail":/\boutlook\b/.test(n)&&!/agenda|calendario|contatos/.test(n)?"outlook":/\bonedrive\b/.test(n)?"onedrive":/\b(drive|docs|sheets|slides)\b/.test(n)?"google-drive":/\byoutube\b/.test(n)&&/canal|canais/.test(n)?"youtube":/\bgoogle\b/.test(n)&&/agenda|calendario/.test(n)?"google-calendar":/\b(microsoft|outlook)\b/.test(n)&&/agenda|calendario/.test(n)?"microsoft-calendar":/\bgoogle\b/.test(n)&&/contatos/.test(n)?"google-contacts":/\bmicrosoft\b/.test(n)&&/contatos/.test(n)?"microsoft-contacts":null;
 if(!service)return null;
 if(/\b(envie|enviar|apague|exclua|publique|crie|edite|altere|conclua|marque|atualize|remova|delete)\b/.test(n))return {service,writeRequested:true};
 if(!/\b(liste|listar|mostre|mostrar|consulte|consultar|verifique|verificar|quais)\b/.test(n))return null;
 return {service,writeRequested:false};
}
