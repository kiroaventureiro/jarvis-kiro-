"use client";
import { useEffect, useState } from "react";
import { claimAutomaticDownload, releaseAutomaticDownload } from "../../lib/downloads/automatic";

/** Render a real generated image; initiate download only after desktop opt-in. */
export function JarvisGeneratedImage({ file, label, id, autoDownload=false }: {file:File;label:string;id:string;autoDownload?:boolean}) {
  const [url,setUrl]=useState<string|null>(null);
  useEffect(()=>{
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size===0 || file.size>8_000_000) return;
    const objectUrl=URL.createObjectURL(file);
    setUrl(objectUrl);
    return ()=>{URL.revokeObjectURL(objectUrl);setUrl(null);};
  },[file]);
  const extension=file.type==="image/png"?"png":file.type==="image/jpeg"?"jpg":"webp";
  useEffect(()=>{
    if(!autoDownload||!url||!claimAutomaticDownload(id))return;
    try {
      const a=document.createElement("a");
      a.href=url;a.download=`jarvis-imagem-${id.slice(0,8)}.${extension}`;
      document.body.appendChild(a);a.click();a.remove();
    }catch{releaseAutomaticDownload(id);}
  },[autoDownload,url,id,extension]);
  return url ? <figure>
    <img src={url} alt={label} style={{maxWidth:"100%",maxHeight:400,objectFit:"contain"}} />
    <figcaption>{label}</figcaption>
  </figure>:null;
}
