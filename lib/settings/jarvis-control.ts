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
  const requested = /(jarvis|configur|preferenc|ajust|ativ|desativ|aument|diminu|reduz|alter|mudar|trocar|coloc|selecion|voz|volume|tom|velocidade|holograma|historico|escuta)/.test(raw);
  if (!requested) return null;
  // Read-only inventory: report actual persisted preferences, never invent access.
  if (/(status|estado|resumo|lista|listar|quais|consultar|mostrar|controle)/.test(raw) &&
      /(configur|preferenc|ajust|componentes|sistema)/.test(raw)) {
    const current = readVoicePreferences();
    let gemini = "não consultada";
    try { const value = localStorage.getItem("jarvis.gemini.voice.v1"); gemini = VOICES.find(v => v === value) || "Orus (padrão experimental)"; } catch {}
    return answer("Configurações disponíveis neste dispositivo: Gemini Live: " + gemini +
      "; volume: " + Math.round(current.volume * 100) + "%; velocidade do navegador: " + current.rate.toFixed(2) +
      "; tom do navegador: " + current.pitch.toFixed(2) + "; retomada da escuta: " + (current.continuous ? "ativada" : "desativada") +
      "; holograma: " + (readGraphicsPreference() === "eco" ? "econômico" : "automático") +
      "; histórico local: " + (historyConsent() ? "habilitado" : "desabilitado") +
      ". Memória central, integrações, credenciais, custos e publicação não são alterados por este controlador.");
  }
  const voice = VOICES.find(v => new RegExp("\\b" + v.toLowerCase() + "\\b").test(raw));
  const command = /\b(mudar|trocar|selecionar|colocar|usar|escolher|definir|quero|alterar|configure|configurar)\b/.test(raw);
  if (voice && (command || /\bvoz\b/.test(raw))) {
    try { localStorage.setItem("jarvis.gemini.voice.v1", voice); window.dispatchEvent(new CustomEvent("jarvis:gemini-voice",{detail:voice})); }
    catch { return answer("Não consegui salvar a preferência vocal neste navegador."); }
    return answer("Voz Gemini "+voice+" selecionada. Será aplicada na próxima sessão, sem interromper a conversa atual.");
  }
  const prefs = readVoicePreferences();
  const amount = raw.match(/\b(\d{1,3})\s*(?:%|por cento)\b/);
  const volume = /\bvolume\b/.test(raw);
  const speed = /\bvelocidade\b/.test(raw);
  const pitch = /\btom\b/.test(raw);
  const explicitChange = /\b(ajustar|ajuste|alterar|altere|configurar|configure|definir|defina|colocar|coloque|aumentar|aumente|diminuir|diminua|reduzir|reduza)\b/.test(raw);
  if ((volume || speed || pitch) && explicitChange) {
    const next = {...prefs};
    const key = volume ? "volume" : speed ? "rate" : "pitch";
    const min = key === "volume" ? 0 : key === "rate" ? 0.7 : 0.6;
    const max = key === "volume" ? 1 : key === "rate" ? 1.3 : 1.2;
    let value: number;
    if (amount) {
      const percentage = Number(amount[1]);
      if (percentage > 100) return answer("Informe um percentual de zero a cem.");
      value = min + percentage / 100 * (max - min);
    } else if (/\b(aumentar|aumente|diminuir|diminua|reduzir|reduza)\b/.test(raw)) {
      value = next[key] + (/\b(aumentar|aumente)\b/.test(raw) ? 1 : -1) * (key === "volume" ? 0.1 : 0.05);
    } else return answer("Qual valor deseja? Você pode pedir, por exemplo, ajuste o volume para 60 por cento.");
    next[key] = Math.max(min,Math.min(max,Number(value.toFixed(3))));
    saveVoicePreferences(next);
    const name = volume ? "Volume" : speed ? "Velocidade" : "Tom";
    return answer(name + " ajustado para " + Math.round((next[key]-min)/(max-min)*100) + " por cento. " + (volume ? "O volume também controla a saída Gemini." : "O ajuste afeta a voz do navegador, não o Gemini Live."));
  }
  if (/\bholograma\b|\bgrafico\b|\bgraficos\b/.test(raw)) {
    if (/\b(economico|economia|eco|reduzir)\b/.test(raw)) { setGraphicsPreference("eco"); return answer("Holograma configurado em modo econômico."); }
    if (/\b(automatico|normal|padrao|auto)\b/.test(raw)) { setGraphicsPreference("auto"); return answer("Holograma configurado para qualidade automática."); }
    if (/\b(qual|estado|atual|como)\b/.test(raw)) return answer("Qualidade atual do holograma: "+(readGraphicsPreference()==="eco"?"econômica":"automática")+".");
  }
  if (/\bhistorico\b/.test(raw) && /(conversa|local|dispositivo|salv|memoria)/.test(raw)) {
    if (/\b(desativar|desative|desligar|desligue|apagar|limpar)\b/.test(raw)) return answer("Desativar o histórico local também elimina as mensagens salvas. Para evitar perda irreversível, confirme essa operação na tela de configurações.");
    if (/\b(ativar|ative|ligar|ligue|habilitar)\b/.test(raw)) { setHistoryConsent(true); return answer("Histórico local deste dispositivo habilitado. Não altera a memória central do Jarvis."); }
    return answer("Histórico local está "+(historyConsent()?"habilitado.":"desabilitado.")+" A memória central do Jarvis é separada.");
  }
  if (/\b(escuta|ouvir)\b/.test(raw) && /\b(continua|automatica|retomar)\b/.test(raw)) {
    if (/\b(desativar|desative|desligar|desligue)\b/.test(raw)) { saveVoicePreferences({...readVoicePreferences(),continuous:false}); return answer("Preferência de retomada da escuta desativada. O botão de áudio infinito continua sob seu controle."); }
    if (/\b(ativar|ative|ligar|ligue)\b/.test(raw)) { saveVoicePreferences({...readVoicePreferences(),continuous:true}); return answer("Preferência de retomada da escuta ativada, quando o navegador permitir."); }
  }
  // Administrative operations remain behind their respective authenticated
  // connectors and explicit approval flows, never a client-side preference write.
  if (/\b(api|chave|token|senha|credencial|deploy|deployment|producao|publicar|permissao|pagamento|custo|limite|integracao|conector|supabase|vercel|github|abacus)\b/.test(raw) &&
      /(configur|ajust|alter|mudar|ativ|desativ|aument|diminu|liber|control)/.test(raw)) {
    return answer("Essa configuração exige um serviço autenticado e autorização específica. Não alterei credenciais, custos, integrações ou deployments. Consulte a Central de Conexões ou a seção de segurança correspondente.");
  }
  if (/\b(configuracoes|configuracao|preferencias)\b/.test(raw) && /\b(todas|todos|quais|lista|mostrar|controle)\b/.test(raw))
    return answer("Posso configurar as vozes Gemini, volume, tom e velocidade da voz do navegador, modo econômico ou automático do holograma, retomada de escuta e histórico local. Outras opções só ficam disponíveis após serem integradas ao registro seguro de configurações. Credenciais, gastos, publicação e segurança exigem aprovação específica.");
  return null;
}
