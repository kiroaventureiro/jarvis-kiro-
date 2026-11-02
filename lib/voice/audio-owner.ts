/** Page-scoped exclusive ownership. Requesting Live never authorizes alternate TTS. */
let liveOwners = 0;
export function claimGeminiAudio() {
  liveOwners++;
  let released = false;
  return () => { if (!released) { released = true; liveOwners--; } };
}
export function assertLegacyAudioAllowed(officialVoice = false) {
  if (liveOwners > 0 && !officialVoice) throw new Error("GEMINI_EXCLUSIVE: síntese alternativa bloqueada enquanto Gemini Live está selecionado.");
}
