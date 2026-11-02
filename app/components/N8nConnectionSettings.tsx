"use client";
import {useCallback,useEffect,useState} from "react";
type Status={vaultConfigured?:boolean;connected?:boolean;verified?:boolean;baseUrl?:string|null;verifiedAt?:string|null};
export default function N8nConnectionSettings(){
  const [status,setStatus]=useState<Status|null>(null),[url,setUrl]=useState(""),[apiKey,setApiKey]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const refresh=useCallback(async()=>{
    try{const r=await fetch("/api/director/n8n",{credentials:"same-origin",cache:"no-store"});const data=await r.json();if(!r.ok)throw Error(data.error||"Consulta indisponível");setStatus(data);}catch(e){setMessage(e instanceof Error?e.message:"Consulta indisponível");}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  async function action(name:"connect"|"test"|"disconnect"){
    if(name==="disconnect"&&!window.confirm("Desconectar o n8n do Jarvis? As credenciais salvas serão eliminadas."))return;
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/director/n8n",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(name==="connect"?{action:name,url,apiKey}:name==="disconnect"?{action:name,confirmation:"DESCONECTAR N8N"}:{action:name})});
      const data=await r.json();
      if(!r.ok)throw Error(data.error||"Falha de conexão");
      setApiKey("");setStatus(data);setMessage(name==="connect"?"n8n conectado e credencial verificada. Workflows ainda precisam de autorização individual.":name==="test"?"Conexão verificada.":"n8n desconectado.");
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
      <button type="button" className="subtle-button" disabled={busy||!status?.connected} onClick={()=>void action("disconnect")}>Desconectar</button>
    </div>
    {message?<p role="status">{message}</p>:null}
    <p><small>Instâncias n8n Cloud são aceitas. Para uma instância própria, o administrador deve configurar o domínio permitido no servidor. Nenhum workflow é executado por este painel.</small></p>
  </section>;
}
