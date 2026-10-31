"use client";
import { useCallback, useState } from "react";
import HolographicCore from "../components/HolographicCore";
import type { CorePhase, AudioVisualMode } from "../../lib/hologram/policy";

/** Isolated visual laboratory; never claims microphone or model connectivity. */
export default function Laboratorio3D() {
  const [phase, setPhase] = useState<CorePhase>("idle");
  const [mode, setMode] = useState<AudioVisualMode>("representative");
  const updateMode = useCallback((next: AudioVisualMode) => setMode(next), []);
  const phases: CorePhase[] = ["idle", "listening", "processing", "responding", "error"];
  return (
    <main style={{minHeight:"100vh", background:"#020714",color:"#d8f5ff",display:"grid",placeItems:"center",padding:"2rem"}}>
      <section style={{width:"min(100%,920px)",textAlign:"center"}}>
        <h1 style={{fontSize:"clamp(1.5rem,3vw,2.4rem)",letterSpacing:".15em"}}>JARVIS KIRO — LABORATÓRIO 3D</h1>
        <p>Prévia isolada do renderizador WebGL já presente no projeto. Os estados são simulados; o microfone não é ativado.</p>
        <div style={{position:"relative",height:"min(60vh,600px)",minHeight:300,overflow:"hidden"}}>
          <HolographicCore phase={phase} hidden={false} inputStream={null} outputStream={null} muted={true} onVisualMode={updateMode}/>
        </div>
        <div role="group" aria-label="Simular estado do Jarvis" style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginTop:24}}>
          {phases.map(value=><button key={value} type="button" aria-pressed={phase===value} onClick={()=>setPhase(value)}
            style={{border:"1px solid #2995c5",borderRadius:24,padding:"10px 16px",color:"#e8fbff",background:phase===value?"#12577d":"#07192b",cursor:"pointer"}}>{value}</button>)}
        </div>
        <p style={{marginTop:18,opacity:.75}}>Visualização de áudio: {mode}. Sem sinal de áudio real.</p>
        <a href="/" style={{color:"#73dfff"}}>Voltar ao Jarvis</a>
      </section>
    </main>
  );
}
