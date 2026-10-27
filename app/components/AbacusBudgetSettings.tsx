"use client";
import {useState} from "react";
type Data={configured?:boolean;paidCallsAllowed?:boolean;callsPerHour?:number;tokenLimitPerHour?:number;usage?:{calls?:number;scope?:string};telemetry?:{totalTokens?:number;attempts?:number;creditsAvailable?:number|null}};
export default function AbacusBudgetSettings(){
 const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function check(){
  setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/director/abacus",{credentials:"same-origin",cache:"no-store"});
   const json:unknown=await r.json();
   if(!r.ok)throw new Error("Não foi possível consultar o estado da Abacus.");
   setData(json as Data);
  }catch(e){setMessage(e instanceof Error?e.message:"Consulta indisponível")}finally{setBusy(false)}
 }
 return <section className="glass notice" aria-label="Orçamento da Abacus">
 <h2>Controle de custos da Abacus</h2>
 <p>Consultar esta configuração não consome chamadas de modelo. O uso cobrado só pode ser liberado com autorização e limite definidos no servidor.</p>
 <button className="subtle-button" type="button" disabled={busy} onClick={check}>Verificar política de uso</button>
 {data?<div role="status">
  <p>Chave de API: {data.configured?"configurada":"não configurada"}</p>
  <p>Chamadas cobradas: <strong>{data.paidCallsAllowed?"autorizadas pela configuração do servidor":"bloqueadas"}</strong></p>
  <p>Limite configurado: {data.callsPerHour??0} chamadas por hora</p>
  <p>Chamadas observadas nesta instância: {data.usage?.calls??0}</p>
  <p>Tokens observados nesta instância: {data.telemetry?.totalTokens??0}</p>
  <p><small>Créditos reais disponíveis: não consultados. Contadores temporários por instância não garantem teto de gasto mensal.</small></p>
 </div>:null}
 {message?<p role="alert">{message}</p>:null}
 </section>
}
