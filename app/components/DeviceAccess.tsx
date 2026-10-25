"use client";
import { useState } from "react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

type Mode = "login" | "register";
async function exchange(url:string, payload?:unknown) {
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload??{})});
  const data=await r.json().catch(()=>({error:"Resposta inválida"}));
  if(!r.ok)throw new Error(data.error||"Falha no acesso");
  return data;
}
export default function DeviceAccess(){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("Autenticação disponível somente quando habilitada e configurada.");
  async function run(mode:Mode){
    setBusy(true);
    try{
      if(mode==="login"){
        const options=await exchange("/api/passkeys/login/options");
        const credential=await startAuthentication({optionsJSON:options});
        await exchange("/api/passkeys/login/verify",credential);
        setMessage("Dispositivo autenticado. Reabra o painel para consultar recursos privados.");
      } else {
        const options=await exchange("/api/passkeys/register/options");
        const credential=await startRegistration({optionsJSON:options});
        await exchange("/api/passkeys/register/verify",{response:credential,deviceLabel:"Dispositivo pessoal"});
        setMessage("Dispositivo cadastrado.");
      }
    }catch(e){setMessage(e instanceof Error?e.message:"Operação indisponível");}
    finally{setBusy(false);}
  }
  return <section aria-label="Acesso por dispositivo" style={{marginTop:"1rem"}}>
    <h2>Dispositivos autorizados</h2>
    <p>Entre com a passkey do seu aparelho. O cadastro de novos dispositivos exige uma sessão existente do proprietário.</p>
    <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap"}}>
      <button type="button" disabled={busy} onClick={()=>run("login")}>Entrar com dispositivo</button>
      <button type="button" disabled={busy} onClick={()=>run("register")}>Cadastrar este dispositivo</button>
    </div>
    <p role="status" aria-live="polite">{message}</p>
  </section>;
}
