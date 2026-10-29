/** Server-neutral artifact access policy. This does not grant storage access. */
export function validJarvisArtifactId(id:string):boolean {
  return /^[A-Za-z0-9_-]{16,120}$/.test(id);
}
export function artifactUnavailableMessage():string {
  return "Arquivo ainda indisponível: nenhum armazenamento de artefatos autenticado foi conectado.";
}
