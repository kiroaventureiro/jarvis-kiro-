import "server-only";
import {createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
export type MemoryTurn={role:"user"|"assistant";content:string};
function credentials(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const raw=process.env.JARVIS_MEMORY_ENCRYPTION_KEY;
 if(!url||!key||!raw)return null;
 let host:URL;try{host=new URL(url)}catch{return null}
 if(host.protocol!=="https:"||host.username||host.password||!host.hostname.endsWith(".supabase.co"))return null;
 const secret=Buffer.from(raw,"base64");
 if(secret.length!==32)return null;
 return {url:host.origin,key,secret};
}
export function memoryConfigured(){return !!credentials()}
function encrypt(data:MemoryTurn[],key:Buffer){
 const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(data),"utf8"),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString("base64");
}
function decrypt(value:string,key:Buffer):MemoryTurn[]{
 const buffer=Buffer.from(value,"base64");if(buffer.length<29)throw new Error("INVALID_MEMORY");
 const decipher=createDecipheriv("aes-256-gcm",key,buffer.subarray(0,12));
 decipher.setAuthTag(buffer.subarray(12,28));
 const result=JSON.parse(Buffer.concat([decipher.update(buffer.subarray(28)),decipher.final()]).toString("utf8")) as unknown;
 if(!Array.isArray(result))throw new Error("INVALID_MEMORY");
 return result.filter((v):v is MemoryTurn=>!!v&&typeof v==="object"&&(v.role==="user"||v.role==="assistant")&&typeof v.content==="string").slice(-20);
}
function normalize(input:MemoryTurn[]){
 return input.filter(x=>x&&(x.role==="user"||x.role==="assistant")&&typeof x.content==="string")
 .slice(-20).map(x=>({role:x.role,content:x.content.slice(0,800)}));
}
async function storage(method:string,body?:object){
 const c=credentials();if(!c)throw new Error("MEMORY_NOT_CONFIGURED");
 const response=await fetch(c.url+"/rest/v1/jarvis_owner_memory?owner_id=eq.default&select=encrypted_history",{
 method,cache:"no-store",headers:{"apikey":c.key,"Authorization":"Bearer "+c.key,
 "Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=representation"},body:body?JSON.stringify(body):undefined,
 signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw new Error("MEMORY_STORAGE_UNAVAILABLE");
 return {data:await response.json() as unknown,key:c.secret};
}
export async function readServerMemory():Promise<MemoryTurn[]>{
 const r=await storage("GET");const items=r.data;
 if(!Array.isArray(items)||items.length===0)return[];
 const first=items[0] as Record<string,unknown>;
 return typeof first.encrypted_history==="string"?decrypt(first.encrypted_history,r.key):[];
}
export async function writeServerMemory(input:MemoryTurn[]):Promise<number>{
 const c=credentials();if(!c)throw new Error("MEMORY_NOT_CONFIGURED");
 const items=normalize(input);
 await storage("POST",{owner_id:"default",encrypted_history:encrypt(items,c.secret),updated_at:new Date().toISOString()});
 return items.length;
}
export async function clearServerMemory(){
 const c=credentials();if(!c)throw new Error("MEMORY_NOT_CONFIGURED");
 await storage("POST",{owner_id:"default",encrypted_history:encrypt([],c.secret),updated_at:new Date().toISOString()});
}
