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
    systemInstruction: { parts: [{ text: instructions + "\nToda solicitação do usuário, inclusive criar pasta/arquivo, aprovar, consultar, alterar projeto ou mencionar GitHub, deve passar por jarvis_conversation ANTES da resposta. Não diga que não existe ferramenta de escrita com base em suposições: somente o núcleo Jarvis pode confirmar capacidade, execução, erro e permissão. Uma aprovação falada deve ser enviada ao núcleo como uma nova fala; nunca suponha que a alteração ocorreu. Relate fielmente o resultado retornado pelo núcleo, inclusive falhas e links verificáveis." }] },
    tools: [{ functionDeclarations: [{
      name: GEMINI_JARVIS_TOOL,
      description: "Consulte o núcleo Jarvis uma vez para CADA fala ou mensagem do usuário, antes de responder. O Jarvis recebe a transcrição original, aplica memória, agentes e autorizações. Não forneça argumentos nem execute ações por conta própria.",
      parameters: { type: Type.OBJECT, properties: {} },
    }] }],
  };
}
