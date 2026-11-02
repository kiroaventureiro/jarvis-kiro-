import { Modality, Type, type LiveConnectConfig } from "@google/genai";
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const GEMINI_JARVIS_TOOL = "jarvis_conversation";
/** No operation/approval arguments: the bridge uses the user's transcript, not a model plan. */
export function geminiLiveConfig(instructions: string, handle?: string): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: handle ? { handle } : {},
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: { automaticActivityDetection: {} },
    systemInstruction: { parts: [{ text: instructions }] },
    tools: [{ functionDeclarations: [{
      name: GEMINI_JARVIS_TOOL,
      description: "Consulte o núcleo Jarvis uma vez para CADA fala ou mensagem do usuário, antes de responder. O Jarvis recebe a transcrição original, aplica memória, agentes e autorizações. Não forneça argumentos nem execute ações por conta própria.",
      parameters: { type: Type.OBJECT, properties: {} },
    }] }],
  };
}
