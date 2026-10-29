/** OBS WebSocket v5, browser → loopback only. Fixed read requests; no server proxy. */
export type ObsSnapshot={checkedAt:string;version:string;websocketVersion:string;currentScene:string;scenes:string[];streaming:boolean;recording:boolean};
export class ObsConnectionError extends Error {
 constructor(public code:"OBS_UNAVAILABLE"|"OBS_TIMEOUT"|"OBS_AUTH_REQUIRED"|"OBS_AUTH_FAILED"|"OBS_INVALID_RESPONSE"|"OBS_CANCELLED"|"OBS_INVALID_PORT"){super(code);}
}
const base64=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
export async function obsAuthentication(password:string,salt:string,challenge:string,cryptography:Crypto=crypto){
 if(!password||password.length>1024||!salt||salt.length>512||!challenge||challenge.length>512)throw new ObsConnectionError("OBS_AUTH_REQUIRED");
 const digest=(text:string)=>cryptography.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return base64(await digest(base64(await digest(password+salt))+challenge));
}
type Socket=Pick<WebSocket,"send"|"close"|"addEventListener"|"removeEventListener">;
export function inspectLocalObs(options:{port:number;password:string;signal?:AbortSignal;timeoutMs?:number},socketFactory:(url:string)=>Socket=url=>new WebSocket(url,"obswebsocket.json")):Promise<ObsSnapshot>{
 if(!Number.isInteger(options.port)||options.port<1024||options.port>65535)return Promise.reject(new ObsConnectionError("OBS_INVALID_PORT"));
 if(options.signal?.aborted)return Promise.reject(new ObsConnectionError("OBS_CANCELLED"));
 const timeout=Math.max(500,Math.min(options.timeoutMs||8000,10000));
 let password=options.password;
 return new Promise((resolve,reject)=>{
  let socket:Socket|null=null,settled=false,phase:"hello"|"hash"|"identify"|"read"="hello";
  let timer:ReturnType<typeof setTimeout>|undefined;
  const responses=new Map<string,Record<string,unknown>>();
  const requests=new Map([["version","GetVersion"],["scenes","GetSceneList"],["stream","GetStreamStatus"],["record","GetRecordStatus"]]);
  const clean=(value:unknown)=>typeof value==="string"?value.replace(/[\x00-\x1f<>]/g," ").slice(0,180):"";
  const finish=(error?:ObsConnectionError,result?:ObsSnapshot)=>{
   if(settled)return;settled=true;password="";if(timer)clearTimeout(timer);
   options.signal?.removeEventListener("abort",cancel);
   if(socket){socket.removeEventListener("message",message);socket.removeEventListener("close",closed);socket.removeEventListener("error",failed);try{socket.close();}catch{/* Cleanup cannot prevent settling the bounded read. */}}
   if(error)reject(error);else resolve(result!);
  };
  const cancel=()=>finish(new ObsConnectionError("OBS_CANCELLED"));
  const failed=()=>finish(new ObsConnectionError("OBS_UNAVAILABLE"));
  const closed=(event:Event)=>finish(new ObsConnectionError((event as CloseEvent).code===4009?"OBS_AUTH_FAILED":"OBS_UNAVAILABLE"));
  const send=(body:unknown)=>socket!.send(JSON.stringify(body));
  const message=(event:Event)=>{void handle(event as MessageEvent).catch(()=>finish(new ObsConnectionError("OBS_INVALID_RESPONSE")));};
  async function handle(event:MessageEvent){
   if(settled)return;
   if(typeof event.data!=="string"||event.data.length>131072)throw Error();
   const packet=JSON.parse(event.data),d=packet?.d;
   if(!d||typeof d!=="object")throw Error();
   if(packet.op===0&&phase==="hello"){
    if(d.rpcVersion!==1)throw Error();
    // Do not silently recommend or accept disabling authentication on the OBS server.
    if(!d.authentication||typeof d.authentication.salt!=="string"||typeof d.authentication.challenge!=="string")return finish(new ObsConnectionError("OBS_AUTH_REQUIRED"));
    phase="hash";
    const authentication=await obsAuthentication(password,d.authentication.salt,d.authentication.challenge);password="";
    if(!settled){phase="identify";send({op:1,d:{rpcVersion:1,authentication,eventSubscriptions:0}});}
    return;
   }
   if(packet.op===2&&phase==="identify"){
    if(d.negotiatedRpcVersion!==1)throw Error();phase="read";
    for(const [id,type]of requests)send({op:6,d:{requestType:type,requestId:id}});
    return;
   }
   if(packet.op===5)return;
   if(packet.op!==7||phase!=="read"||!requests.has(d.requestId)||requests.get(d.requestId)!==d.requestType||responses.has(d.requestId)||d.requestStatus?.result!==true||!d.responseData)throw Error();
   responses.set(d.requestId,d.responseData);
   if(responses.size!==requests.size)return;
   const version=responses.get("version")!,scenes=responses.get("scenes")!,stream=responses.get("stream")!,record=responses.get("record")!;
   if(typeof version.obsVersion!=="string"||typeof version.obsWebSocketVersion!=="string"||!Array.isArray(scenes.scenes)||scenes.scenes.length>200||!scenes.scenes.every(s=>s&&typeof s.sceneName==="string")||typeof scenes.currentProgramSceneName!=="string"||typeof stream.outputActive!=="boolean"||typeof record.outputActive!=="boolean")throw Error();
   finish(undefined,{checkedAt:new Date().toISOString(),version:clean(version.obsVersion),websocketVersion:clean(version.obsWebSocketVersion),currentScene:clean(scenes.currentProgramSceneName),scenes:scenes.scenes.map(s=>clean(s.sceneName)),streaming:stream.outputActive,recording:record.outputActive});
  }
  try{
   socket=socketFactory("ws://127.0.0.1:"+options.port);
   socket.addEventListener("message",message);socket.addEventListener("close",closed);socket.addEventListener("error",failed);
   options.signal?.addEventListener("abort",cancel,{once:true});
   timer=setTimeout(()=>finish(new ObsConnectionError("OBS_TIMEOUT")),timeout);
  }catch{finish(new ObsConnectionError("OBS_UNAVAILABLE"));}
 });
}
