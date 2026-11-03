"use client";
import {useEffect,useState} from "react";
type Provider="github"|"vercel"|"supabase";
type Conn={status:string;verifiedAt:string|null;resources:{id:string}[];grants:string[];lastError?:string};
type Item={provider:Provider;connection:Conn|null;oauthConfigured:boolean};
type Overview={configured:boolean;providers:Item[]};
const names:Record<Provider,string>={github:"GitHub",vercel:"Vercel",supabase:"Supabase"};
async function request(payload:unknown){
 const r=await fetch("/api/director/connectors",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(payload)});
 const data=await r.json();if(!r.ok)throw Error(data.error||"Falha ao consultar conexão");return data;
}
export default function SimpleDevelopmentConnections(){
 const [view,setView]=useState<Overview|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState<Provider|null>(null);
 const [manual,setManual]=useState<Provider|null>(null),[token,setToken]=useState(""),[teamId,setTeamId]=useState("");
 async function refresh(){const r=await fetch("/api/director/connectors",{cache:"no-store",credentials:"same-origin"});const d=await r.json();if(!r.ok)throw Error(d.error||"Conexões indisponíveis");setView(d);}
 useEffect(()=>{void refresh().catch(e=>setError(String(e.message||e)));},[]);
 async function run(p:Provider,fn:()=>Promise<void>){setBusy(p);setError("");try{await fn();await refresh();}catch(e){setError(e instanceof Error?e.message:"Operação indisponível");}finally{setBusy(null);}}
 async function connect(p:Provider){await run(p,async()=>{const data=await request({op:"connect",provider:p});const url=new URL(data.authorizationUrl);if(url.protocol!=="https:"||!["github.com","vercel.com","api.supabase.com"].includes(url.hostname))throw Error("Destino inválido");window.location.assign(url.href);});}
 async function saveToken(p:Provider){await run(p,async()=>{await request({op:"token",provider:p,token,...(p==="vercel"&&teamId?{teamId}:{})});if(p==="github"){const result=await request({op:"test",provider:p});await request({op:"scope",provider:p,resources:result.resources,grants:["read","write"]});}setManual(null);setToken("");});}
 async function verify(p:Provider){await run(p,async()=>{const result=await request({op:"test",provider:p});if(p==="github"){await request({op:"scope",provider:"github",resources:result.resources,grants:["read","write"]});}});}
 return <section className="glass notice" aria-label="Conexões de desenvolvimento">
 <h2>Conexões de desenvolvimento</h2><p>Conecte uma vez. O Jarvis utiliza os recursos já autorizados na conta; ações de alteração continuam exigindo autorização apropriada.</p>
 {error?<p role="alert">{error}</p>:null}
 {!view?<p>Verificando conexões…</p>:view.providers.map(p=>{const c=p.connection;const connected=c?.status==="connected"&&!!c.verifiedAt&&!c.lastError;
 return <div key={p.provider} className="glass notice" style={{marginBottom:12}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
 <strong>{names[p.provider]}</strong><span role="status">{connected?"Conectado":c?.status==="connected"?"Verificação necessária":"Não conectado"}</span>
 </div>
 {connected?<p>Conta autorizada. {c?.resources.length||0} recursos registrados no Jarvis.</p>:null}
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 {!c||c.status!=="connected"?<><button type="button" disabled={!!busy||!view.configured} onClick={()=>void connect(p.provider)}>Conectar</button><button type="button" disabled={!!busy} onClick={()=>{setManual(p.provider);setToken("");}}>Usar token</button></>:<button type="button" disabled={!!busy} onClick={()=>void verify(p.provider)}>Verificar conexão</button>}
 </div>
 {manual===p.provider?<form onSubmit={e=>{e.preventDefault();void saveToken(p.provider)}}><label>Token de acesso <input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required/></label>{p.provider==="vercel"?<label>ID da equipe (opcional)<input value={teamId} onChange={e=>setTeamId(e.target.value)}/></label>:null}<button disabled={!!busy||!token} type="submit">Salvar conexão</button><button type="button" onClick={()=>{setManual(null);setToken("");}}>Cancelar</button></form>:null}
 </div>})}
 </section>;
}
