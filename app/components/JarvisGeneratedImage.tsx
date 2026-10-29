"use client";
import { useEffect, useState } from "react";

/** Displays a genuinely generated, in-memory image without uploading it or exposing credentials. */
export function JarvisGeneratedImage({ file, label }: {file: File; label:string}) {
  const [url,setUrl] = useState<string|null>(null);
  useEffect(()=>{
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 8_000_000) return;
    const objectUrl=URL.createObjectURL(file);
    setUrl(objectUrl);
    return ()=>{URL.revokeObjectURL(objectUrl); setUrl(null);};
  },[file]);
  return url ? <figure><img src={url} alt={label} style={{maxWidth:"100%",maxHeight:400,objectFit:"contain"}} /><figcaption>{label}</figcaption></figure> : null;
}
