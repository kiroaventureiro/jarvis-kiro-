import type { JarvisUnifiedResult } from "./unified-result";

/** Safe view-model for the Jarvis conversation UI; never interprets HTML or media URLs. */
export function jarvisResultView(result: JarvisUnifiedResult) {
  const statusLabel: Record<JarvisUnifiedResult["status"],string> = {
    draft:"Rascunho", needs_authorization:"Aguardando autorização",
    queued:"Na fila",running:"Executando",completed:"Concluído",failed:"Falhou",
  };
  return {
    requestId:result.requestId,
    title:result.source==="codex"?"Codex":result.source==="navi"?"Navi":result.source==="image"?"Imagem":"Ferramenta",
    status:result.status,
    statusLabel:statusLabel[result.status],
    messages:result.messages.filter(x=>typeof x==="string"&&x.length>0).slice(0,20),
    artifacts:result.artifacts.filter(a=>a && typeof a.name==="string" && a.name.length <= 180 && typeof a.mimeType==="string" && a.mimeType.length <= 100).slice(0,20)
      .map(a=>({type:a.type,name:a.name,mimeType:a.mimeType,previewUrl:
        safeArtifactPreview(a.previewUrl)})),
  };
}

/** Only same-origin relative files or approved short-lived HTTPS hosts should be linked. */
function safeArtifactPreview(url?: string): string | undefined {
  if (!url || url.length > 2048 || !url.startsWith("/api/director/artifacts/")) return undefined;
  if (url.includes("..") || url.includes("\\") || url.includes("?") || url.includes("#")) return undefined;
  return /^\/api\/director\/artifacts\/[A-Za-z0-9_-]{16,120}$/.test(url) ? url : undefined;
}
