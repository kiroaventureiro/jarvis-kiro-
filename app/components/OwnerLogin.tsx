"use client";
import {useState} from "react";
export default function OwnerLogin(){
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function login(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/auth",{method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Acesso não autorizado");
   setPassword("");
   setMessage("Sessão iniciada. Você já pode voltar à tela do Jarvis.");
  }catch(err){setMessage(err instanceof Error?err.message:"Falha de autenticação")}
  finally{setBusy(false)}
 }
 return <section aria-label="Login do proprietário">
  <h2>Acesso do proprietário</h2>
  <p>Entre com sua senha privada para liberar uma sessão no Jarvis. Nenhuma senha será exibida ou salva no navegador.</p>
  <form onSubmit={login} style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",alignItems:"center"}}>
   <label htmlFor="jarvis-owner-pass">Senha</label>
   <input id="jarvis-owner-pass" type="password" autoComplete="current-password"
    value={password} onChange={e=>setPassword(e.target.value)} required minLength={12}
    style={{padding:"0.75rem",borderRadius:"0.7rem",maxWidth:"24rem",width:"100%"}}/>
   <button type="submit" disabled={busy||password.length<12}>{busy?"Entrando...":"Entrar"}</button>
  </form>
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
