import type { HoloScene } from "../holo/types";
import type { ConnectorResultLink } from "../connectors/result";
export type VoicePhase =
  | "off"
  | "waiting"
  | "command"
  | "processing"
  | "speaking"
  | "resuming"
  | "error";
export type VoicePreferences = {
  version: 1;
  voiceURI: string;
  maleConfirmedURI: string;
  rate: number;
  pitch: number;
  volume: number;
  continuous: boolean;
};
export type VoiceDescriptor = {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
};
export type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
export type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};
export interface RecognitionDriver {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
}
export type RecognitionConstructor = new () => RecognitionDriver;
export interface SpeechOutput {
  speak(
    text: string,
    signal: AbortSignal,
    options?: { scene?: HoloScene },
  ): Promise<void>;
  cancel(): void;
}
export type VoiceReply = {
  text: string;
  navigate?: string;
  provider?: string;
  result?: ConnectorResultLink;
  visual?: HoloScene;
};
