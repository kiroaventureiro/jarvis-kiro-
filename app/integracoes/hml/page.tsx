"use client";
import { useState } from "react";
import InternalPage from "../../components/InternalPage";
type Reference={jobId:string;planId:string;digest:string};
export default function HmlVerification(){
 const [reference,setReference]=useState<Reference|null>(null),[approved,setApproved]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[result,setResult]=useState<Record<string,unknown>|null>(null);
 async function post(path:string,body:unknown){
  const response=await fetch(path,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Não foi possível confirmar a operação.");
  return data;
 }
 async function run(action:"register"|"approve"|"status"){
  setBusy(true);setMessage("");
  try{
   if(action==="register"){
    const id="hml_ui_"+crypto.randomUUID().replaceAll("-","");
    const data=await post("/api/orchestration/hml",{schemaVersion:1,environment:"homologation",jobId:id,planId:id,idempotencyKey:id,capability:"simulation.success",simulationScenario:"success",contextRef:"audit/ui/"+id,contextExpiresAt:new Date(Date.now()+20*60000).toISOString()});
    const r=data.result;
    if(data.acceptedByIngress!==true || r?.persisted!==true || r.jobId!==id || r.planId!==id || !/^[a-f0-9]{64}$/.test(r.digest))throw Error("O n8n não confirmou o registro durável do teste.");
    setReference({jobId:r.jobId,planId:r.planId,digest:r.digest});setApproved(false);setResult(null);setMessage("Teste registrado no n8n. Aguardando sua aprovação.");
   }else if(action==="approve" && reference){
    const r=await post("/api/orchestration/hml/approvals",{...reference,approvalId:"approval_"+reference.jobId,capability:"simulation.success",decision:"approve",expiresAt:new Date(Date.now()+10*60000).toISOString()});
    if(r.decisionRecorded!==true)throw Error("A aprovação não foi confirmada.");
    setApproved(true);setMessage("Aprovação registrada. Execute o despachante HML no n8n e consulte o resultado.");
   }else if(action==="status" && reference){
    const r=await post("/api/orchestration/hml/status",reference);setResult(r);
    setMessage(r.jobState==="succeeded"&&r.result?.simulated===true?"Percurso confirmado: o resultado simulado persistido no n8n voltou ao Jarvis.":"Estado atual: "+r.jobState);
   }
  }catch(error){setMessage(error instanceof Error?error.message:"Falha ao verificar integração.");}finally{setBusy(false);}
 }
 return <InternalPage title="Verificação do n8n" eyebrow="Homologação isolada">
  <section className="card" style={{padding:24,display:"grid",gap:16}}>
   <h2>Confirmar a ligação com o Jarvis</h2>
   <p>Este percurso usa somente uma tarefa sintética. Nenhum e-mail, publicação ou alteração em serviços externos será executado. A voz e a conversa principal permanecem como estão.</p>
   <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
    <button disabled={busy||!!reference} onClick={()=>run("register")}>1. Registrar teste</button>
    <button disabled={busy||!reference||approved} onClick={()=>run("approve")}>2. Aprovar este teste</button>
    <button disabled={busy||!reference} onClick={()=>run("status")}>3. Consultar resultado</button>
   </div>
   <p role="status" aria-live="polite">{busy?"Conferindo…":message}</p>
   {reference&&<p style={{overflowWrap:"anywhere"}}>Referência: {reference.jobId}</p>}
   {result&&<pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(result,null,2)}</pre>}
   <p>A execução depende do despachante HML, que atualmente é manual. As chaves ficam no servidor e não aparecem nesta tela.</p>
  </section>
 </InternalPage>;
}
