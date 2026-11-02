"use client";
import { readVoicePreferences, saveVoicePreferences } from "../voice/voice-preferences";
import { readGraphicsPreference, setGraphicsPreference } from "../hologram/policy";
import { historyConsent, setHistoryConsent } from "../device-history";

/** Single explicit, allowlisted route for Jarvis-owned client preferences.
 * Never takes arbitrary keys, code, URLs, secrets, spending or permissions.
 * The same stores are used by the existing settings screens.
 */
const VOICES = ["Orus", "Charon", "Algenib", "Gacrux", "Puck", "Kore"] as const;
type Result = { text: string; model: "jk-settings"; provider: "local_operational"; usage: null; visual: undefined };
const answer = (text: string): Result => ({text,model:"jk-settings",provider:"local_operational",usage:null,visual:undefined});
export function jarvisSettingsCommand(text: string): Result | null {
  const raw = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const requested = /\b(jarvis|configur|preferenc|ajust|ativ|desativ|lig|deslig|aument|diminu|reduz|alter|mudar|trocar|coloc|selecion|voz|volume|tom|velocidade|holograma|historico|escuta)\b/.test(raw);
  if (!requested) return null;
  const voice = VOICES.find(v => new RegExp("\\b" + v.toLowerCase() + "\\b").test(raw));
  const command = /\b(mudar|trocar|selecionar|colocar|usar|escolher|definir|quero|alterar|configure|configurar)\b/.test(raw);
  if (voice && (command || /\bvoz\b/.test(raw))) {
    try { localStorage.setItem("jarvis.gemini.voice.v1", voice); window.dispatchEvent(new CustomEvent("jarvis:gemini-voice",{detail:voice})); }
    catch { return answer("Não consegui salvar a preferência vocal neste navegador."); }
    return answer("Voz Gemini "+voice+" selecionada. Será aplicada na próxima sessão, sem interromper a conversa atual.");
  }
  if (/\bholograma\b|\bgrafico\b|\bgraficos\b/.test(raw)) {
    if (/\b(economico|economia|eco|reduzir)\b/.test(raw)) { setGraphicsPreference("eco"); return answer("Holograma configurado em modo econômico."); }
    if (/\b(automatico|normal|padrao|auto)\b/.test(raw)) { setGraphicsPreference("auto"); return answer("Holograma configurado para qualidade automática."); }
    if (/\b(qual|estado|atual|como)\b/.test(raw)) return answer("Qualidade atual do holograma: "+(readGraphicsPreference()==="eco"?"econômica":"automática")+".");
  }
  if (/\bhistorico\b/.test(raw) && /\b(conversa|local|dispositivo|salv|memoria)\b/.test(raw)) {
    if (/\b(desativar|desative|desligar|desligue|apagar|limpar)\b/.test(raw)) return answer("Desativar o histórico local também elimina as mensagens salvas. Para evitar perda irreversível, confirme essa operação na tela de configurações.");
    if (/\b(ativar|ative|ligar|ligue|habilitar)\b/.test(raw)) { setHistoryConsent(true); return answer("Histórico local deste dispositivo habilitado. Não altera a memória central do Jarvis."); }
    return answer("Histórico local está "+(historyConsent()?"habilitado.":"desabilitado.")+" A memória central do Jarvis é separada.");
  }
  if (/\b(escuta|ouvir)\b/.test(raw) && /\b(continua|automatica|retomar)\b/.test(raw)) {
    if (/\b(desativar|desative|desligar|desligue)\b/.test(raw)) { saveVoicePreferences({...readVoicePreferences(),continuous:false}); return answer("Preferência de retomada da escuta desativada. O botão de áudio infinito continua sob seu controle."); }
    if (/\b(ativar|ative|ligar|ligue)\b/.test(raw)) { saveVoicePreferences({...readVoicePreferences(),continuous:true}); return answer("Preferência de retomada da escuta ativada, quando o navegador permitir."); }
  }
  if (/\b(configuracoes|configuracao|preferencias)\b/.test(raw) && /\b(todas|todos|quais|lista|mostrar|controle)\b/.test(raw))
    return answer("Posso configurar as vozes Gemini, volume, tom e velocidade da voz do navegador, modo econômico ou automático do holograma, retomada de escuta e histórico local. Outras opções só ficam disponíveis após serem integradas ao registro seguro de configurações. Credenciais, gastos, publicação e segurança exigem aprovação específica.");
  return null;
}
