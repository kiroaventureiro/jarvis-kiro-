"use client";
import { memo, useEffect, useRef } from "react";
import type { CorePhase, AudioVisualMode } from "../../lib/hologram/policy";
import { observeAudio } from "../../lib/hologram/audio";

type Props = {
  phase: CorePhase; hidden: boolean; inputStream: MediaStream | null;
  outputStream: MediaStream | null; muted: boolean;
  onVisualMode: (mode: AudioVisualMode) => void;
};
const presets = {
  idle: {speed:.40, glow:.80, radius:74},
  listening:{speed:.80,glow:1,radius:78},
  processing:{speed:2.4,glow:1.35,radius:70},
  responding:{speed:1.1,glow:1.15,radius:82},
  connecting:{speed:1.4,glow:1.1,radius:74},
  error:{speed:.16,glow:.55,radius:74}
};
type Preset = typeof presets.idle;
const clamp = (n:number,a:number,b:number) => Math.max(a,Math.min(b,n));

/** Approved Abacus canvas nucleus, rewritten as a React renderer without mocked responses.
 * Audio and state are supplied by JarvisExperience, not independently simulated. */
function RefinedJarvisCore({phase,hidden,inputStream,outputStream,muted,onVisualMode}:Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({phase,hidden,muted,level:0});
  live.current.phase=phase; live.current.hidden=hidden; live.current.muted=muted;
  useEffect(()=>{
    const stream = phase === "listening" ? inputStream
      : phase === "responding" && !muted ? outputStream : null;
    const envelope = observeAudio(hidden ? null : stream,phase==="listening"?"input-level":"output-level");
    onVisualMode(envelope.mode);
    let id = 0;
    const tick = () => {
      live.current.level = envelope.read() ?? 0;
      id = requestAnimationFrame(tick);
    };
    tick();
    return ()=>{cancelAnimationFrame(id);envelope.dispose();};
  },[phase,hidden,inputStream,outputStream,muted,onVisualMode]);
  useEffect(()=>{
    const el=canvas.current, host=el?.parentElement;
    const ctx=el?.getContext("2d");
    if(!el||!host||!ctx) return;
    let w=0,h=0,dpr=1,raf=0,visible=true,last=0;
    const current:Preset={...presets.idle};
    const points=Array.from({length:440},()=>({
      ratio:1.15+Math.pow(Math.random(),1.8)*2.1,
      angle:Math.random()*Math.PI*2,
      speed:.6+Math.random()*.8,
      size:1+Math.random()*2.1,
      opacity:.28+Math.random()*.68
    }));
    function resize(){
      dpr=Math.min(window.devicePixelRatio||1,2);
      w=host!.clientWidth;h=host!.clientHeight;
      el!.width=Math.max(1,Math.floor(w*dpr));
      el!.height=Math.max(1,Math.floor(h*dpr));
      ctx!.setTransform(dpr,0,0,dpr,0,0);
    }
    const obs=new ResizeObserver(resize);obs.observe(host);
    const motion=matchMedia("(prefers-reduced-motion: reduce)");
    const visibility=()=>{visible=!document.hidden;};
    document.addEventListener("visibilitychange",visibility);
    resize();
    const draw=(now:number)=>{
      raf=requestAnimationFrame(draw);
      if(!visible||live.current.hidden||w===0||h===0)return;
      if(motion.matches && now-last<120) return;
      last=now;
      const p=presets[live.current.phase as keyof typeof presets] || presets.idle;
      for(const key of ["speed","glow","radius"] as const)
        current[key]+=(p[key]-current[key])*.05;
      const t=now/1000,energy=clamp(live.current.level,0,1);
      const cx=w/2,cy=h/2-(h>500?25:0);
      const scale=clamp(Math.min(w/1050,h/760),.58,1.3);
      const r=current.radius*scale;
      ctx!.clearRect(0,0,w,h);
      ctx!.save();ctx!.translate(cx,cy);
      for(let ring=1;ring<=3;ring++){
        ctx!.save();
        ctx!.rotate(t*.12*(ring%2?1:-1)*current.speed);
        ctx!.setLineDash([2,12+ring*4]);
        ctx!.strokeStyle="rgba(159,227,255,"+( .2*current.glow)+")";
        ctx!.lineWidth=1;
        ctx!.beginPath();ctx!.arc(0,0,r*(1.7+ring*.55),0,Math.PI*2);ctx!.stroke();
        ctx!.restore();
      }
      ctx!.setLineDash([]);
      ctx!.save();ctx!.rotate(-.33);
      for(const pt of points){
        const angle=pt.angle+t*current.speed*pt.speed*(1.6/pt.ratio);
        const distance=r*pt.ratio;
        const x=Math.cos(angle)*distance*1.8;
        const y=Math.sin(angle)*distance*.52;
        const doppler=.5+.5*(-Math.sin(angle));
        const alpha=clamp(pt.opacity*doppler*(current.glow+energy*.2)*1.2,0,1);
        ctx!.fillStyle="hsla("+(190+doppler*22)+",100%,"+(64+doppler*26)+"%,"+alpha+")";
        ctx!.beginPath();ctx!.arc(x,y,pt.size*scale*(.8+doppler*.4),0,Math.PI*2);ctx!.fill();
      }
      ctx!.restore();
      const radius=r*1.08*(1+.045*Math.sin(t*(live.current.phase==="processing"?6:2.4))+energy*.03);
      const gradient=ctx!.createRadialGradient(0,0,radius*.8,0,0,radius*1.65);
      gradient.addColorStop(0,"#ffffff");
      gradient.addColorStop(.25,"rgba(159,227,255,"+clamp(.9*current.glow,0,1)+")");
      gradient.addColorStop(.7,"rgba(40,110,255,.2)");
      gradient.addColorStop(1,"rgba(0,0,0,0)");
      ctx!.fillStyle=gradient;ctx!.beginPath();ctx!.arc(0,0,radius*1.65,0,Math.PI*2);ctx!.fill();
      ctx!.fillStyle="#010309";
      ctx!.beginPath();ctx!.arc(0,0,r,0,Math.PI*2);ctx!.fill();
      ctx!.lineWidth=2;ctx!.strokeStyle="rgba(200,245,255,.95)";
      ctx!.shadowColor="#9fe3ff";ctx!.shadowBlur=16*scale;ctx!.stroke();
      ctx!.restore();
    };
    raf=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(raf);obs.disconnect();document.removeEventListener("visibilitychange",visibility);};
  },[]);
  return <div className="jk-refined-core" data-phase={phase} data-hidden={hidden}>
    <canvas ref={canvas} aria-label="Núcleo Jarvis refinado: horizonte escuro, halo azul e partículas orbitais reativas ao estado da voz" role="img" />
  </div>;
}
export default memo(RefinedJarvisCore);
