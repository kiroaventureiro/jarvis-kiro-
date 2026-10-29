/** Device-only optional history. Not a server memory or encrypted vault. */
const KEY="jarvis_kiro_opt_in_history_v1";
const CONSENT="jarvis_kiro_history_consent_v1";
const MAX_ITEMS=16,MAX_TEXT=600,TTL=7*24*60*60*1000;
export type SavedMessage={id:string;role:"user"|"assistant";text:string};
export function historyConsent():boolean{try{return localStorage.getItem(CONSENT)==="yes"}catch{return false}}
export function setHistoryConsent(enabled:boolean):void{
 try{if(enabled)localStorage.setItem(CONSENT,"yes");else{localStorage.removeItem(CONSENT);localStorage.removeItem(KEY)}}catch{}
}
export function saveDeviceHistory(messages:SavedMessage[]):void{
 if(!historyConsent())return;
 try{
 const safe=messages.filter(m=>(m.role==="user"||m.role==="assistant")&&typeof m.text==="string"&&m.text.trim())
 .slice(-MAX_ITEMS).map(m=>({id:m.id.slice(0,100),role:m.role,text:m.text.slice(0,MAX_TEXT)}));
 localStorage.setItem(KEY,JSON.stringify({expires:Date.now()+TTL,messages:safe}))
 }catch{}
}
export function loadDeviceHistory():SavedMessage[]{
 if(!historyConsent())return[];
 try{
 const raw=localStorage.getItem(KEY);if(!raw)return[];
 const data=JSON.parse(raw) as {expires?:unknown;messages?:unknown};
 if(typeof data.expires!=="number"||data.expires<Date.now()||!Array.isArray(data.messages)){
  localStorage.removeItem(KEY);return[];
 }
 return data.messages.slice(-MAX_ITEMS).filter((m:unknown):m is SavedMessage=>{
  if(!m||typeof m!=="object")return false;
  const v=m as Record<string,unknown>;
  return typeof v.id==="string"&&v.id.length<=100&&(v.role==="user"||v.role==="assistant")&&typeof v.text==="string"&&v.text.length<=MAX_TEXT
 });
 }catch{return[]}
}
