/** Normalized Jarvis presentation contract. Data only; no external provider calls. */
export type JarvisResultSource = "navi" | "codex" | "image" | "other";
export type JarvisResultStatus = "draft" | "needs_authorization" | "queued" | "running" | "completed" | "failed";
export type JarvisArtifactType = "image" | "document" | "video" | "code" | "report";
export type JarvisArtifact = {
  type: JarvisArtifactType;
  mimeType: string;
  name: string;
  storageKey: string;
  /** Server-issued, authenticated or expiring URL, never a provider secret. */
  previewUrl?: string;
};
export type JarvisUnifiedResult = {
  requestId: string;
  source: JarvisResultSource;
  status: JarvisResultStatus;
  messages: string[];
  artifacts: JarvisArtifact[];
  provenance?: { provider: string; taskReference?: string; resultReference?: string };
};
export function codexDraftResult(task: {
  id:string; state:"draft"; repository:string; branch:string; kind?:"review"|"test"|"implement";
}): JarvisUnifiedResult {
  return {
    requestId:task.id,
    source:"codex",
    status:"draft",
    messages:["Tarefa Codex registrada como rascunho. Um executor autenticado ainda não foi conectado; nenhuma execução começou."],
    artifacts:[],
    provenance:{provider:"codex-planner",taskReference:task.id},
  };
}

/** Display-only Navi response adapter; no provider API call or invented media. */
export function naviTextResult(input: {
  requestId: string;
  text: string;
  provider: string;
}): JarvisUnifiedResult {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(input.requestId) || !input.text.trim() || input.text.length > 20000 ||
      !/^[a-zA-Z0-9._-]{1,100}$/.test(input.provider))
    throw Error("INVALID_NAVI_RESULT");
  return {
    requestId: input.requestId,
    source: "navi",
    status: "completed",
    messages: [input.text],
    artifacts: [],
    provenance: { provider: input.provider },
  };
}
