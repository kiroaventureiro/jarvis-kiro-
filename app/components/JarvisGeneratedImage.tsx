"use client";
import { useEffect, useState } from "react";

/** Show and save only images genuinely returned by the image provider. */
export function JarvisGeneratedImage({ file, label }: {file: File; label:string}) {
  const [url,setUrl] = useState<string|null>(null);
  useEffect(()=>{
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) ||
        file.size === 0 || file.size > 8_000_000) return;
    const objectUrl=URL.createObjectURL(file);
    setUrl(objectUrl);
    return ()=>{URL.revokeObjectURL(objectUrl); setUrl(null);};
  },[file]);
  const extension=file.type==="image/png"?"png":file.type==="image/jpeg"?"jpg":"webp";
  return url ? <figure>
    <img src={url} alt={label} style={{maxWidth:"100%",maxHeight:400,objectFit:"contain"}} />
    <figcaption>{label}</figcaption>
    <a href={url} download={`jarvis-imagem.${extension}`} aria-label="Salvar imagem gerada">Salvar imagem</a>
  </figure> : null;
}
