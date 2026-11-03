import { Modality, Type, type LiveConnectConfig } from "@google/genai";
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const GEMINI_JARVIS_TOOL = "jarvis_conversation";
export const GEMINI_VOICE_CHOICES = ["Orus", "Charon", "Algenib", "Gacrux", "Puck", "Kore"] as const;
/** No operation/approval arguments: the bridge uses the user's transcript, not a model plan. */
export function geminiLiveConfig(instructions: string, handle?: string, voiceName = "Orus"): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    // Experimental prebuilt voice only; never change the functional backup branch.
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: handle ? { handle } : {},
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: { automaticActivityDetection: {} },
    systemInstruction: { parts: [{ text: instructions + "\nToda solicitação do usuário, seja sobre vida pessoal, criação, pesquisa, memória, agenda, conteúdo, aplicativo, integração ou sistema, deve passar por jarvis_conversation ANTES da resposta. A intenção e o contexto do proprietário têm prioridade sobre palavras-chave rígidas. O núcleo Jarvis determina capacidades, permissões e evidências; você nunca presume que uma ação ocorreu nem inventa acesso. Para qualquer operação, comunique o resultado real do núcleo: concluído com prova, parcial, pendente, incerto ou falho. Se falhar, explique a causa comprovada ou a incerteza, identifique outra rota segura autorizada quando possível e diga exatamente o requisito que falta. Não encaminhe genericamente para uma central quando o núcleo puder investigar. Autorizações faladas são novas mensagens ao núcleo, não autorização presumida. Preserve toda a personalidade do Jarvis independentemente da plataforma." }] },
    tools: [{ functionDeclarations: [{
      name: GEMINI_JARVIS_TOOL,
      description: "Consulte o núcleo Jarvis uma vez para CADA fala ou mensagem do usuário, antes de responder. O Jarvis recebe a transcrição original, aplica memória, agentes e autorizações. Não forneça argumentos nem execute ações por conta própria.",
      parameters: { type: Type.OBJECT, properties: {} },
    }] }],
  };
}
