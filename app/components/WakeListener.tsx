"use client";
import {useEffect,useRef,useState} from "react";

type SpeechResult={isFinal:boolean;0:{transcript:string}};
type SpeechEvent={resultIndex:number;results:ArrayLike<SpeechResult>};
type BrowserRecognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((e:SpeechEvent)=>void)|null;onerror:((e:{error:string})=>void)|null;onend:(()=>void)|null;start:()=>void;stop:()=>void};
type SpeechConstructor=new()=>BrowserRecognition;
type Props={onMessage:(text:string)=>Promise<string>;muted:boolean};
const wake=/\bjarvis\b/i;
export default function WakeListener({onMessage,muted}:Props){
 const [enabled,setEnabled]=useState(false);
 const [status,setStatus]=useState("");
 const recognition=useRef<BrowserRecognition|null>(null);
 const enabledRef=useRef(false);
 const speaking=useRef(false);
 const busy=useRef(false);
 const callback=useRef(onMessage);
 const mutedRef=useRef(muted);
 useEffect(()=>{callback.current=onMessage},[onMessage]);
 useEffect(()=>{mutedRef.current=muted},[muted]);
 const stop=()=>{
  enabledRef.current=false;setEnabled(false);setStatus("Escuta desligada");
  recognition.current?.stop();
  globalThis.speechSynthesis?.cancel();
 };
 useEffect(()=>()=>{enabledRef.current=false;recognition.current?.stop();globalThis.speechSynthesis?.cancel()},[]);
 function activate(){
  if(enabledRef.current){stop();return}
  const api=window as Window & {SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};
  const Constructor=api.SpeechRecognition??api.webkitSpeechRecognition;
  if(!Constructor){setStatus("Reconhecimento de voz indisponível neste navegador");return}
  const rec=new Constructor();recognition.current=rec;
  rec.lang="pt-BR";rec.continuous=true;rec.interimResults=false;
  enabledRef.current=true;setEnabled(true);setStatus("Aguardando: Jarvis");
  rec.onresult=(event)=>{
   if(!enabledRef.current||busy.current||speaking.current)return;
   for(let i=event.resultIndex;i<event.results.length;i++){
    const result=event.results[i];
    if(!result.isFinal)continue;
    const transcript=result[0]?.transcript?.trim()??"";
    if(!wake.test(transcript))continue;
    busy.current=true;setStatus("Processando pedido");
    void (async()=>{
     try{
      const answer=await callback.current(transcript);
      if(enabledRef.current&&!mutedRef.current&&"speechSynthesis" in window){
       recognition.current?.stop();
       speaking.current=true;
       const speech=new SpeechSynthesisUtterance(answer.slice(0,1000));
       speech.lang="pt-BR";speech.rate=1;
       speech.onend=()=>{speaking.current=false;busy.current=false;if(enabledRef.current)try{rec.start()}catch{}};
       speech.onerror=()=>{speaking.current=false;busy.current=false;if(enabledRef.current)try{rec.start()}catch{}};
       window.speechSynthesis.speak(speech);
      }else{busy.current=false}
      setStatus("Aguardando: Jarvis");
     }catch{
      busy.current=false;setStatus("Falha ao responder; escuta permanece ativa");
     }
    })();
    break;
   }
  };
  rec.onerror=(event)=>{if(event.error==="not-allowed"||event.error==="service-not-allowed"){enabledRef.current=false;setEnabled(false);setStatus("Permissão de microfone negada")}else if(event.error!=="no-speech"&&event.error!=="aborted")setStatus("Reconhecimento temporariamente indisponível")};
  rec.onend=()=>{if(enabledRef.current&&!speaking.current){try{rec.start()}catch{setStatus("Clique para reativar a escuta");enabledRef.current=false;setEnabled(false)}}};
  try{rec.start()}catch{enabledRef.current=false;setEnabled(false);setStatus("Não foi possível ativar o microfone")}
 }
 return <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
  <button type="button" onClick={activate} aria-pressed={enabled} title="Escuta por palavra de ativação: Jarvis" className={"icon-button "+(enabled?"active":"")}>{enabled?"◉":"◎"}</button>
  <span role="status" aria-live="polite" style={{fontSize:"0.75rem",opacity:.8}}>{status}</span>
 </div>;
}
