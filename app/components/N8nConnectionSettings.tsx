"use client";
import {useCallback,useEffect,useState} from "react";
type Status={vaultConfigured?:boolean;connected?:boolean;verified?:boolean;baseUrl?:string|null;verifiedAt?:string|null};
type Report={id:string;state:string;report?:{total:number;active:number;partial:boolean;names:string[]};error?:string};
export default function N8nConnectionSettings(){
  const [report,setReport]=useState<Report|null>(null);
  const [detail,setDetail]=useState<{name:string;active:boolean;nodes:Array<{id:string;name:string;type:string;disabled:boolean}>;settings:Record<string,unknown>;note:string}|null>(null);
  const [workflows,setWorkflows]=useState<Array<{id:string;name:string;active:boolean}>|null>(null);
  const [status,setStatus]=useState<Status|null>(null),[url,setUrl]=useState(""),[apiKey,setApiKey]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const refresh=useCallback(async()=>{
    try{const r=await fetch("/api/director/n8n",{credentials:"same-origin",cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Consulta indisponível");setStatus(data);}catch(e){setMessage(e instanceof Error?e.message:"Consulta indisponível");}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function catalogReport(update=false){
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/director/n8n",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(update&&report?{action:"catalog-report-status",id:report.id}:{action:"catalog-report"})});
      const data=await r.json();if(!r.ok)throw Error(data.error||"Relatório indisponível");setReport(data);
    }catch(e){setMessage(e instanceof Error?e.message:"Relatório indisponível");}finally{setBusy(false);}
  }
  async function details(id:string){
    setBusy(true);setMessage("");setDetail(null);
    try{
      const r=await fetch("/api/director/n8n",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"details",id})});
      const data=await r.json();if(!r.ok)throw Error(data.error||"Consulta indisponível");setDetail(data);
    }catch(e){setMessage(e instanceof Error?e.message:"Consulta indisponível");}finally{setBusy(false);}
  }
  async function action(name:"connect"|"test"|"disconnect"|"list"){
    if(name==="disconnect"&&!window.confirm("Desconectar o n8n do Jarvis? As credenciais salvas serão eliminadas."))return;
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/director/n8n",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(name==="connect"?{action:name,url,apiKey}:name==="disconnect"?{action:name,confirmation:"DESCONECTAR N8N"}:{action:name})});
      const data=await r.json();
      if(!r.ok)throw Error(data.error||"Falha de conexão");
      if(name==="list"){setWorkflows(data.workflows||[]);setMessage("Workflows consultados somente para leitura. Nenhuma execução foi iniciada.");return;}
      setApiKey("");setStatus(data);if(name==="disconnect"||name==="connect"){setWorkflows(null);setDetail(null);setReport(null);}setMessage(name==="connect"?"n8n conectado e credencial verificada. Workflows ainda precisam de autorização individual.":name==="test"?"Conexão verificada.":"n8n desconectado.");
    }catch(e){setMessage(e instanceof Error?e.message:"Falha de conexão");}
    finally{setBusy(false);}
  }
  return <section className="glass notice" aria-label="Conector n8n">
    <h2>Conector n8n</h2>
    <p>Conecte sua instância n8n. A chave de API fica criptografada no cofre do servidor, não no navegador. Esta conexão não autoriza automaticamente workflows ou serviços externos.</p>
    <p role="status">{status?.connected?(status.verified?"Conectado e verificado":"Conectado, aguardando verificação"):"Não conectado"}{status?.baseUrl?" · "+status.baseUrl:""}</p>
    {status?.vaultConfigured===false?<p role="alert">O cofre de conexões do Jarvis precisa estar configurado no servidor.</p>:null}
    <label htmlFor="n8n-url">Endereço HTTPS do n8n</label>
    <input id="n8n-url" type="url" autoComplete="off" placeholder="https://sua-instancia.app.n8n.cloud" value={url} onChange={e=>setUrl(e.target.value)} disabled={busy}/>
    <label htmlFor="n8n-key">Chave de API n8n</label>
    <input id="n8n-key" type="password" autoComplete="new-password" placeholder="Cole a chave de API" value={apiKey} onChange={e=>setApiKey(e.target.value)} disabled={busy}/>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
      <button type="button" className="subtle-button" disabled={busy||!url||!apiKey} onClick={()=>void action("connect")}>Conectar n8n</button>
      <button type="button" className="subtle-button" disabled={busy||!status?.connected} onClick={()=>void action("test")}>Testar conexão</button>
      <button type="button" className="subtle-button" disabled={busy||!status?.connected} onClick={()=>void action("list")}>Ver workflows</button>
      <button type="button" className="subtle-button" disabled={busy||!status?.connected} onClick={()=>void catalogReport()}>Executar relatório no n8n</button>
      <button type="button" className="subtle-button" disabled={busy||!status?.connected} onClick={()=>void action("disconnect")}>Desconectar</button>
    </div>
    {message?<p role="status">{message}</p>:null}
    {report?<section aria-label="Resultado do relatório n8n"><h3>Relatório executado no n8n</h3><p>Estado: {report.state} · Referência: {report.id}</p>{report.report?<><p>{report.report.total} workflows; {report.report.active} publicados.{report.report.partial?" Catálogo parcial.":""}</p><ul>{report.report.names.map((name,i)=><li key={i}>{name}</li>)}</ul></>:null}{report.error?<p>{report.error}</p>:null}<button type="button" disabled={busy} onClick={()=>void catalogReport(true)}>Atualizar resultado do relatório</button><p>Workflow fixo de leitura do catálogo; não altera configurações nem executa os demais fluxos.</p></section>:null}
    {workflows?<div><h3>Workflows identificados ({workflows.length})</h3><ul>{workflows.map(w=><li key={w.id}>{w.name} — {w.active?"ativo no n8n":"inativo no n8n"} <button type="button" disabled={busy} onClick={()=>void details(w.id)}>Ver configuração de {w.name}</button></li>)}</ul><p>Lista apenas para consulta; o Jarvis não executa esses workflows automaticamente.</p></div>:null}
    {detail?<section aria-label="Configuração do workflow"><h3>{detail.name}</h3><p>{detail.active?"Publicado":"Inativo"}</p><ul>{detail.nodes.map(n=><li key={n.id}>{n.name} — {n.type}{n.disabled?" (desativado)":""}</li>)}</ul><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(detail.settings,null,2)}</pre><p>{detail.note}</p></section>:null}
    <p><small>Instâncias n8n Cloud são aceitas. Para uma instância própria, o administrador deve configurar o domínio permitido no servidor. Nenhum workflow é executado por este painel.</small></p>
  </section>;
}
