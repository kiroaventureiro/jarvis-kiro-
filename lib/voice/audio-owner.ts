/** Page-scoped exclusive ownership. Requesting Live never authorizes alternate TTS. */
let liveOwners = 0;
export function claimGeminiAudio() {
  liveOwners++;
  let released = false;
  return () => { if (!released) { released = true; liveOwners--; } };
}
export function assertLegacyAudioAllowed() {
  if (liveOwners > 0) throw new Error("GEMINI_EXCLUSIVE: síntese alternativa bloqueada enquanto Gemini Live está selecionado.");
}
