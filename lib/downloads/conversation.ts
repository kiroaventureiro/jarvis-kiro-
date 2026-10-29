export type ConversationalDownloadIntent = "accept"|"decline"|"request"|"other";
/** Only apply short confirmations when an actual file awaits a download decision. */
export function conversationalDownloadIntent(text:string,pending:boolean):ConversationalDownloadIntent {
 const t=text.trim().toLocaleLowerCase("pt-BR").replace(/[.!?]+$/,"").trim();
 if(!pending)return "other";
 if(/^(sim|quero|pode|pode baixar|sim, pode baixar|sim quero|sim, quero|baixe|baixar|faça o download)$/.test(t))return "accept";
 if(/^(não|nao|agora não|agora nao|não precisa|nao precisa|cancela|cancelar)$/.test(t))return "decline";
 if(/^(baixe (a )?(imagem|foto|arquivo)|quero baixar (a )?(imagem|foto|arquivo))$/.test(t))return "request";
 return "other";
}
