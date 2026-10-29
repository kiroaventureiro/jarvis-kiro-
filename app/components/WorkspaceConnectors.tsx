"use client";
import {useEffect,useState} from "react";
type View={providers:Array<{provider:"google"|"microsoft";authorizationReady:boolean;missing:string[];connected:boolean;services:string[];verifiedAt:Record<string,string>;callback:string|null}>;services:Array<{id:string;provider:string;name:string;scope:string}>};
export default function WorkspaceConnectors(){
 const [view,setView]=useState<View|null>(null),[selected,setSelected]=useState<string[]>([]),[error,setError]=useState(""),[busy,setBusy]=useState(false),[results,setResults]=useState<Record<string,{checkedAt:string;items:Array<{id:string;name:string}>}>>({});
 async function load(){const r=await fetch("/api/director/workspace-connectors",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(!r.ok)throw Error(d.error);setView(d);}
 useEffect(()=>{const ac=new AbortController();fetch("/api/director/workspace-connectors",{credentials:"same-origin",cache:"no-store",signal:ac.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setView(d);}).catch(e=>{if(!ac.signal.aborted)setError(e.message);});return()=>ac.abort();},[]);
 async function action(body:Record<string,unknown>){setBusy(true);setError("");try{
  const r=await fetch("/api/director/workspace-connectors",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);
  if(d.authorizationUrl){const u=new URL(d.authorizationUrl);if(u.protocol!=="https:"||!["accounts.google.com","login.microsoftonline.com"].includes(u.hostname))throw Error("Destino inválido.");window.location.assign(u.href);return;}
  if(d.items)setResults(old=>({...old,[String(body.service)]:d}));
  if(body.op==="disconnect")setResults(old=>Object.fromEntries(Object.entries(old).filter(([key])=>!view?.services.some(s=>s.id===key&&s.provider===body.provider))));
  await load();
 }catch(e){setError(e instanceof Error?e.message:"Consulta indisponível.");}finally{setBusy(false);}}
 return <section id="workspace-connectors" className="glass notice" aria-label="Conectar Google e Microsoft">
  <h2>Google e Microsoft · autorização por serviço</h2>
  <p>Selecione os serviços e autorize na tela oficial. Esta versão lista até cinco registros por consulta; não lê corpos de e-mail, não edita arquivos, não envia mensagens e não publica no YouTube.</p>
  <p>Docs, Sheets e Slides compartilham a listagem de arquivos do Drive; Word, Excel e PowerPoint compartilham a listagem do OneDrive. Isso não habilita edição de documentos.</p>
  {error?<p role="alert">{error}</p>:null}
  {!view&&!error?<p>Consultando configuração…</p>:null}
  {view?.providers.map(p=><article key={p.provider} className="glass card" style={{padding:16,marginBottom:12}}>
   <h3>{p.provider==="google"?"Google / Kiro TV":"Microsoft 365"}</h3>
   <p>{p.connected?"Autorização salva; verifique cada serviço para confirmar o acesso.":p.authorizationReady?"Pronto para solicitar sua autorização.":"Configuração administrativa pendente; autorizar a conta ainda não é suficiente."}</p>
   {p.missing.length?<p>Falta: {p.missing.join("; ")}. O administrador deve registrar os callbacks e habilitar as APIs necessárias no provedor. Não envie chaves no chat.</p>:null}
   {p.missing.length ? <p><a href={p.provider==="google"?"https://console.cloud.google.com/auth/clients":"https://entra.microsoft.com/"} target="_blank" rel="noopener noreferrer">Abrir configuração administrativa {p.provider==="google"?"Google":"Microsoft"}</a></p> : null}
   {p.callback?<p>Callback para registrar no provedor: <code style={{overflowWrap:"anywhere"}}>{p.callback}</code></p>:null}
   <fieldset disabled={busy} style={{border:0,padding:0}}><legend>Permissões de leitura solicitadas</legend>
    {view.services.filter(s=>s.provider===p.provider).map(s=><div key={s.id} style={{margin:"12px 0"}}>
     <label><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/> {s.name}</label>
     <details><summary>Permissão exata</summary><code style={{overflowWrap:"anywhere"}}>{s.scope}</code></details>
     {p.services.includes(s.id)?<><button type="button" disabled={busy} onClick={()=>action({op:"read",service:s.id})}>Verificar e listar {s.name}</button>
      {p.verifiedAt[s.id]?<p>Última leitura verificada: {new Date(p.verifiedAt[s.id]).toLocaleString("pt-BR")}</p>:null}
      {results[s.id]?<div role="status"><p>{results[s.id].items.length} registros retornados; conteúdo externo.</p><ul>{results[s.id].items.map((item,i)=><li key={item.id||i}>{item.name}</li>)}</ul></div>:null}</>:null}
    </div>)}
   </fieldset>
   <button type="button" disabled={busy||!p.authorizationReady||!view.services.some(s=>s.provider===p.provider&&selected.includes(s.id))} onClick={()=>action({op:"authorize",provider:p.provider,services:view.services.filter(s=>s.provider===p.provider&&selected.includes(s.id)).map(s=>s.id)})}>Autorizar serviços selecionados no {p.provider==="google"?"Google":"Microsoft"}</button>
   {p.connected?<button type="button" disabled={busy} onClick={()=>{if(window.confirm("Remover a autorização guardada no Jarvis? A revogação no provedor é separada."))void action({op:"disconnect",provider:p.provider,confirmation:"DESCONECTAR"});}}>Remover acesso do Jarvis</button>:null}
  </article>)}
 </section>;
}
