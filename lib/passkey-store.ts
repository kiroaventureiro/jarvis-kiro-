import "server-only";
import { createHash } from "node:crypto";
import type { WebAuthnCredential } from "@simplewebauthn/server";

function settings() {
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.startsWith("https://") || !key) throw new Error("Private passkey storage unavailable");
  return {url:url.replace(/\/$/,""),key};
}
async function request(path:string,method:string,body?:unknown,prefer?:string) {
  const {url,key}=settings();
  const res=await fetch(url+path,{method,headers:{"apikey":key,"Authorization":`Bearer ${key}`,"Content-Type":"application/json",...(prefer?{"Prefer":prefer}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!res.ok) throw new Error("Passkey storage request failed");
  return res;
}
type StoredKey={credential_id:string;public_key:string;counter:number;transports:string[];revoked_at:string|null};
export async function getCredential(id:string):Promise<WebAuthnCredential|null>{
  const res=await request("/rest/v1/jarvis_passkeys?credential_id=eq."+encodeURIComponent(id)+"&revoked_at=is.null&select=credential_id,public_key,counter,transports,revoked_at&limit=1","GET");
  const rows=await res.json() as StoredKey[];const row=rows[0];
  if(!row)return null;
  return {id:row.credential_id,publicKey:new Uint8Array(Buffer.from(row.public_key,"base64url")),counter:row.counter,transports:row.transports as WebAuthnCredential["transports"]};
}
export async function storeCredential(credential:WebAuthnCredential,label:string) {
  if(label.length>80)throw new Error("Invalid device label");
  await request("/rest/v1/jarvis_passkeys","POST",{
    credential_id:credential.id, public_key:Buffer.from(credential.publicKey).toString("base64url"),
    counter:credential.counter,transports:credential.transports??[],device_label:label||"Dispositivo"
  },"return=minimal");
}
export async function advanceCounter(id:string,oldCounter:number,newCounter:number){
  const path="/rest/v1/jarvis_passkeys?credential_id=eq."+encodeURIComponent(id)+"&revoked_at=is.null&counter=eq."+oldCounter;
  const res=await request(path,"PATCH",{counter:newCounter,last_used_at:new Date().toISOString()},"return=representation");
  const rows=await res.json() as unknown[];
  if(rows.length!==1)throw new Error("Credential counter changed; reject session");
}
