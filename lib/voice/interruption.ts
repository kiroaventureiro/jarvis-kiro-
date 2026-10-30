import { normalizeSpeech } from "./wake-word-policy";

const STOP_PHRASES = new Set(["pare","para","parar","pare de falar","para de falar","cala a boca","cale a boca","silencio","chega","stop","stop talking","be quiet","shut up","quiet"]);
export function isStopCommand(text: string): boolean {
  const normalized = normalizeSpeech(text).replace(/\b(jarvis|por favor|please|ok|ei|hey)\b/g," ").replace(/\s+/g," ").trim();
  return STOP_PHRASES.has(normalized);
}
export function isSelfEcho(transcript: string, spoken: string): boolean {
  if (isStopCommand(transcript)) return false;
  const heard = normalizeSpeech(transcript).split(" ").filter(Boolean);
  if (!heard.length) return true;
  const said = new Set(normalizeSpeech(spoken).split(" ").filter(Boolean));
  return heard.filter(word => said.has(word)).length / heard.length >= .6;
}
type Stopper = () => void;
const stoppers = new Set<Stopper>();
const listeners = new Set<(state: "idle" | "listening" | "interrupted") => void>();
let transition: ReturnType<typeof setTimeout> | null = null;
export function registerAudioStopper(stop: Stopper) { stoppers.add(stop); return () => { stoppers.delete(stop); }; }
export function subscribeInterruption(listener: (state: "idle" | "listening" | "interrupted") => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function notify(state: "idle" | "listening" | "interrupted") { for (const fn of listeners) { try { fn(state); } catch {} } }
export function stopAll(options: {resumeListening?: boolean} = {}) {
  if (transition !== null) clearTimeout(transition);
  for (const stop of stoppers) { try { stop(); } catch {} }
  if (typeof window !== "undefined") { try { window.speechSynthesis?.cancel(); } catch {} }
  notify("interrupted");
  transition = setTimeout(() => { transition = null; notify(options.resumeListening ? "listening" : "idle"); }, 700);
}
