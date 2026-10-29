export type VoiceAction = "volume_up"|"volume_down"|"keyboard"|"files"|"pause"|"none";
export function voiceAction(input:string):VoiceAction {
 const s=input.toLowerCase().trim();
 if(/(aument|suba).*(volume|voz|som)/.test(s))return "volume_up";
 if(/(dimin|abaix|reduz).*(volume|voz|som)/.test(s))return "volume_down";
 if(/(teclado|campo de texto|escrever)/.test(s))return "keyboard";
 if(/(inserir|escolher|selecionar).*(imagem|foto|arquivo)/.test(s))return "files";
 if(/(pause|pausa|pare).*(fala|audio|demonstra)/.test(s))return "pause";
 return "none";
}
