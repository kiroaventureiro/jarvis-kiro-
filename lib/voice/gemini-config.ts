import { Modality, Type, type LiveConnectConfig } from "@google/genai";
// Temporary reliability pin: 3.8 Live has a reported output-audio regression (transcription arrives while PCM chunks are empty/tiny).
// Keep the same Gemini Live architecture and voice config while validating 3.1 Live output.
export const GEMINI_LIVE_MODEL = "gemini-3.1-flash-live-preview";
export const GEMINI_JARVIS_TOOL = "jarvis_conversation";
/** No operation/approval arguments: the bridge uses the user's transcript, not a model plan. */
export function geminiLiveConfig(instructions: string, handle?: string): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    // Pin a stable, mature prebuilt voice instead of relying on the model default.
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
