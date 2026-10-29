"use client";
import {useEffect,useRef,useState} from "react";
import {inspectLocalObs,ObsConnectionError,type ObsSnapshot} from "../../lib/obs/local-client";
const errors:Record<string,string>={OBS_UNAVAILABLE:"Não foi possível acessar o OBS neste aparelho. Abra o OBS, confira a porta e permita a conexão local se o navegador solicitar. Se o navegador bloquear, a conexão permanece indisponível; não desative suas proteções.",OBS_TIMEOUT:"O OBS não respondeu dentro do prazo. Confira se o servidor WebSocket está habilitado.",OBS_AUTH_REQUIRED:"Use o servidor WebSocket do OBS com autenticação e a senha gerada por ele.",OBS_AUTH_FAILED:"O OBS recusou a autenticação. Confira a senha do servidor WebSocket.",OBS_INVALID_RESPONSE:"A resposta não confirmou o protocolo OBS WebSocket v5 esperado.",OBS_INVALID_PORT:"Informe a porta WebSocket configurada no OBS (1024 a 65535).",OBS_CANCELLED:"Consulta cancelada."};
export default function ObsConnection(){
 const [password,setPassword]=useState(""),[port,setPort]=useState("4455"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[snapshot,setSnapshot]=useState<ObsSnapshot|null>(null);
 const controller=useRef<AbortController|null>(null),mounted=useRef(true);
 const [networkPermission,setNetworkPermission]=useState<string>("unknown");
 useEffect(()=>{let active=true;let permission:PermissionStatus|undefined;const update=()=>{if(active&&permission)setNetworkPermission(permission.state);};if(navigator.permissions?.query)navigator.permissions.query({name:"loopback-network" as PermissionName}).then(value=>{if(!active)return;permission=value;update();permission.addEventListener("change",update);}).catch(()=>{if(active)setNetworkPermission("unsupported");});else setNetworkPermission("unsupported");return()=>{active=false;permission?.removeEventListener("change",update);};},[]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
 async function inspect(){
  controller.current?.abort();const ac=new AbortController();controller.current=ac;
  const secret=password;setPassword("");setBusy(true);setError("");setSnapshot(null);
  try{const result=await inspectLocalObs({port:Number(port),password:secret,signal:ac.signal});if(mounted.current&&!ac.signal.aborted)setSnapshot(result);}
  catch(e){if(mounted.current)setError(e instanceof ObsConnectionError?errors[e.code]:errors.OBS_UNAVAILABLE);}
  finally{if(mounted.current)setBusy(false);}
 }
 return <section id="obs-connection" className="glass notice" aria-label="OBS Kiro TV local">
  <h2>OBS / Kiro TV · consulta no mesmo aparelho</h2>
  <p>Abra esta página no computador onde o OBS está instalado. No OBS, use Ferramentas → Configurações do servidor WebSocket e habilite o servidor com autenticação. O OBS moderno já inclui o WebSocket v5.</p>
  <p>A conexão vai diretamente deste navegador para 127.0.0.1, sem instalar um agente, expor o OBS na internet ou passar pela Vercel. No celular, localhost aponta para o celular, não para o computador.</p>
  <p>Permissão do navegador para acessar este aparelho: {networkPermission==="granted"?"permitida":networkPermission==="denied"?"bloqueada":networkPermission==="prompt"?"será solicitada ao conectar":"verificação não disponível; compatibilidade depende do navegador"}.</p>
  {networkPermission==="denied"?<p role="status">No ícone ao lado do endereço, abra as permissões deste site e permita o acesso a aplicativos/serviços neste dispositivo (loopback). Não desative as proteções do navegador.</p>:<p>Se o navegador solicitar acesso a aplicativos neste aparelho, autorize somente se quiser consultar o OBS local.</p>}
  <form onSubmit={e=>{e.preventDefault();void inspect();}}>
   <label>Porta WebSocket do OBS <input aria-label="Porta WebSocket do OBS" type="number" min="1024" max="65535" value={port} disabled={busy} onChange={e=>setPort(e.target.value)}/></label>
   <label>Senha WebSocket do OBS · somente neste aparelho <input aria-label="Senha WebSocket do OBS" type="password" autoComplete="off" value={password} maxLength={1024} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
   <p>Use a senha gerada pelo OBS, não uma senha de conta. O campo é limpo ao consultar; a senha não é salva, enviada ao servidor do Jarvis ou colocada em logs.</p>
   <button disabled={busy||!password||networkPermission==="denied"} type="submit">{busy?"Consultando OBS…":"Verificar OBS local"}</button>
   {busy?<button type="button" onClick={()=>controller.current?.abort()}>Cancelar consulta OBS</button>:null}
  </form>
  {error?<p role="alert">{error}</p>:null}
  {snapshot?<div role="status">
   <p>Leitura confirmada em {new Date(snapshot.checkedAt).toLocaleString("pt-BR")}. OBS {snapshot.version} · WebSocket {snapshot.websocketVersion}. A conexão de consulta já foi encerrada.</p>
   <p>Cena atual: {snapshot.currentScene}. Transmissão: {snapshot.streaming?"ativa":"inativa"}. Gravação: {snapshot.recording?"ativa":"inativa"}.</p>
   <p>Cenas disponíveis ({snapshot.scenes.length}):</p><ul>{snapshot.scenes.map((scene,i)=><li key={i}>{scene}</li>)}</ul>
  </div>:null}
  <p>Somente leitura. Esta versão não troca cenas, inicia lives, grava, altera áudio ou controla o computador.</p>
 </section>;
}
