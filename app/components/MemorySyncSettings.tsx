"use client";
import {useState} from "react";
import {historyConsent,loadDeviceHistory,saveDeviceHistory,setHistoryConsent} from "../../lib/device-history";
type MemoryTurn={role:"user"|"assistant";content:string};
export default function MemorySyncSettings(){
 const [state,setState]=useState<"unknown"|"ready"|"unconfigured"|"error">("unknown");
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 async function send(method:"GET"|"PUT"|"DELETE",body?:object){
  const response=await fetch("/api/director/memory-history",{
   method,credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   body:body?JSON.stringify(body):undefined
  });
  const result:unknown=await response.json();
  if(!response.ok)throw new Error(result&&typeof result==="object"&&"error" in result?String(result.error):"Serviço indisponível");
  return result as {configured?:boolean;history?:MemoryTurn[];saved?:number;cleared?:boolean};
 }
 async function inspect(){
  setBusy(true);setMessage("");
  try{const result=await send("GET");setState(result.configured?"ready":"unconfigured");
   setMessage(result.configured?"Armazenamento remoto disponível. Nada é sincronizado automaticamente.":"Armazenamento remoto não configurado.");
  }catch(e){setState("error");setMessage(e instanceof Error?e.message:"Erro de conexão")}finally{setBusy(false)}
 }
 async function backup(){
  if(!historyConsent()){setMessage("Ative primeiro 'Guardar neste dispositivo' na tela principal do Jarvis.");return}
  const local=loadDeviceHistory();
  if(!local.length){setMessage("Não há histórico local para enviar.");return}
  if(!window.confirm("Enviar o histórico recente deste dispositivo para a memória criptografada do servidor? O histórico remoto anterior será substituído."))return;
  setBusy(true);
  try{const r=await send("PUT",{history:local.slice(-20).map(({role,text})=>({role,content:text}))});
   setMessage(`Cópia de ${r.saved??0} mensagens salva no servidor.`)}catch(e){setMessage(e instanceof Error?e.message:"Falha ao salvar")}finally{setBusy(false)}
 }
 async function restore(){
  if(!window.confirm("Substituir o histórico guardado neste navegador pela cópia do servidor?"))return;
  setBusy(true);
  try{
   const r=await send("GET");if(!r.configured)throw new Error("Armazenamento não configurado");
   const turns=(r.history??[]).slice(-16).map(x=>({id:crypto.randomUUID(),role:x.role,text:x.content.slice(0,600)}));
   setHistoryConsent(true);saveDeviceHistory(turns);
   setMessage(`Cópia restaurada neste navegador (${turns.length} mensagens). Atualize a página principal para carregá-la.`);
  }catch(e){setMessage(e instanceof Error?e.message:"Falha ao restaurar")}finally{setBusy(false)}
 }
 async function erase(){
  if(!window.confirm("Apagar definitivamente a cópia de conversas no servidor? Isso não apaga automaticamente o histórico neste dispositivo."))return;
  setBusy(true);
  try{await send("DELETE");setMessage("Histórico remoto esvaziado.")}catch(e){setMessage(e instanceof Error?e.message:"Falha ao apagar")}finally{setBusy(false)}
 }
 return <section className="glass notice" aria-label="Memória sincronizada">
  <h2>Memória entre dispositivos</h2>
  <p>Opcional. Cópia manual e criptografada de conversas recentes, quando o servidor for configurado. Não há sincronização automática ou novas cobranças ativadas.</p>
  <button className="subtle-button" type="button" disabled={busy} onClick={inspect}>Verificar disponibilidade</button>
  {state==="ready"?<div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:12}}>
   <button className="subtle-button" disabled={busy} onClick={backup}>Guardar cópia no servidor</button>
   <button className="subtle-button" disabled={busy} onClick={restore}>Restaurar neste dispositivo</button>
   <button className="subtle-button" disabled={busy} onClick={erase}>Apagar cópia do servidor</button>
  </div>:null}
  {message?<p role="status">{message}</p>:null}
  <p><small>Somente conversas recentes; não inclui arquivos. O histórico local não é criptografado. Evite registrar dados sensíveis.</small></p>
 </section>
}
