"use client";
import {useEffect,useRef,useState} from "react";
export default function DeviceCamera(){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),photoRef=useRef<string|null>(null);
 const [active,setActive]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[photo,setPhoto]=useState("");
 const stop=()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setActive(false);};
 useEffect(()=>{const hide=()=>{if(document.hidden)stop();};document.addEventListener("visibilitychange",hide);return()=>{document.removeEventListener("visibilitychange",hide);stream.current?.getTracks().forEach(t=>t.stop());if(photoRef.current)URL.revokeObjectURL(photoRef.current);};},[]);
 async function start(){setBusy(true);setError("");try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error("Câmera indisponível; use um navegador compatível em HTTPS.");
  const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
  if(!video.current){media.getTracks().forEach(t=>t.stop());return;}
  stream.current=media;video.current.srcObject=media;await video.current.play();setActive(true);
 }catch{stop();setError("Não foi possível abrir a câmera. Confira a permissão do navegador e se outro aplicativo está usando o dispositivo.");}finally{setBusy(false);}}
 function capture(){const v=video.current;if(!v?.videoWidth)return;const canvas=document.createElement("canvas");canvas.width=v.videoWidth;canvas.height=v.videoHeight;canvas.getContext("2d")?.drawImage(v,0,0);canvas.toBlob(blob=>{if(!blob)return;if(photoRef.current)URL.revokeObjectURL(photoRef.current);const url=URL.createObjectURL(blob);photoRef.current=url;setPhoto(url);},"image/png");}
 return <section id="device-camera" className="glass notice" aria-label="Câmera do dispositivo">
  <h2>Câmera · uso local</h2><p>Funciona com sua permissão no navegador, sem conta Google. Não usa microfone, não grava vídeo e não envia imagens ao servidor.</p>
  <video ref={video} muted playsInline style={{display:active?"block":"none",maxWidth:"100%"}} aria-label="Prévia da câmera"/>
  {error?<p role="alert">{error}</p>:null}
  <button type="button" disabled={busy||active} onClick={start}>Permitir e abrir câmera</button>
  <button type="button" disabled={!active} onClick={capture}>Capturar foto local</button>
  <button type="button" disabled={!active} onClick={stop}>Desligar câmera</button>
  {photo?<div><img src={photo} alt="Foto capturada localmente" style={{maxWidth:"100%"}}/><a href={photo} download="jarvis-foto.png">Salvar foto no dispositivo</a></div>:null}
 </section>;
}
