import "server-only";

type Provider = "google" | "microsoft";
type Resource = "files" | "mail" | "calendar";
type Failure = { ok:false; code:"NOT_AUTHORIZED"|"UNAVAILABLE"|"PERMISSION_DENIED"|"RATE_LIMITED"; message:string };
type Success = { ok:true; provider:Provider; resource:Resource; source:"live"; fetchedAt:string; items:Array<Record<string,unknown>> };
const plans:Record<Provider,Record<Resource,string>>={
 google:{
  files:"https://www.googleapis.com/drive/v3/files?page_size=10&fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)&q=trashed%3Dfalse",
  mail:"https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10",
  calendar:"https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&singleEvents=true&orderBy=startTime"
 },
 microsoft:{
  files:"https://graph.microsoft.com/v1.0/me/drive/root/children?$top=10&$select=id,name,webUrl,lastModifiedDateTime,file,folder",
  mail:"https://graph.microsoft.com/v1.0/me/messages?$top=10&$select=id,subject,receivedDateTime,webLink",
  calendar:"https://graph.microsoft.com/v1.0/me/events?$top=10&$select=id,subject,start,end,webLink"
 }
};
export async function readWorkspace(provider:Provider, resource:Resource, token:string):Promise<Failure|Success>{
 if(!token.trim())return {ok:false,code:"NOT_AUTHORIZED",message:"Autorização do provedor ainda não concedida."};
 try{
  const response=await fetch(plans[provider][resource],{
   headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},
   cache:"no-store",signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)return {ok:false,code:response.status===401||response.status===403?"PERMISSION_DENIED":response.status===429?"RATE_LIMITED":"UNAVAILABLE",message:"Consulta externa não autorizada ou indisponível."};
  const body=await response.json() as {files?:unknown;messages?:unknown;items?:unknown;value?:unknown};
  const entries=provider==="google"?(resource==="files"?body.files:resource==="mail"?body.messages:body.items):body.value;
  return {ok:true,provider,resource,source:"live",fetchedAt:new Date().toISOString(),
   items:Array.isArray(entries)?entries.slice(0,10).filter(x=>typeof x==="object"&&x!==null):[]};
 }catch{return {ok:false,code:"UNAVAILABLE",message:"Falha de comunicação com o provedor."};}
}
