/** Browser-only user preference. Never trigger downloads before explicit opt-in. */
export const AUTO_DOWNLOAD_KEY="jarvis.desktop.auto-download.v1";
export function desktopDownloadsSupported(userAgent:string,coarsePointer:boolean):boolean {
 return !/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent)&&!coarsePointer;
}
export function readAutoDownloadPreference(storage:Pick<Storage,"getItem">):boolean {
 try {return storage.getItem(AUTO_DOWNLOAD_KEY)==="enabled";}catch{return false;}
}
export function saveAutoDownloadPreference(storage:Pick<Storage,"setItem">,enabled:boolean):boolean {
 try {storage.setItem(AUTO_DOWNLOAD_KEY,enabled?"enabled":"disabled");return true;}catch{return false;}
}
/** Deduplicate downloads by generated result identity during one browser session. */
const downloaded=new Set<string>();
export function claimAutomaticDownload(id:string):boolean {
 if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)||downloaded.has(id))return false;
 downloaded.add(id);return true;
}
export function releaseAutomaticDownload(id:string):void {downloaded.delete(id);}
