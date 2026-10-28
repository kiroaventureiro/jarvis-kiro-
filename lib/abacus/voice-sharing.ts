/** Owner approved this destination and these metadata fields in the current project.
 * Never attach account observations to session startup or unrelated turns. */
const KEY = "jk-abacus-neural-sharing-v1";
export function abacusAccountQuestion(message: string) {
  const n = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    /\b(abacus|routellm|chatllm)\b/.test(n) &&
    /\b(conta|plano|saldo|creditos|tarefas|agentes|recursos|funcionalidades)\b/.test(
      n,
    ) &&
    /\b(quais|qual|quanto|quantos|como|voce|tem|existe|pode|consegue|diga|fale|informe)\b/.test(
      n,
    ) &&
    !/^\s*(?:jarvis[, ]*)?(?:crie|gere|execute|publique|apague|envie|conecte)\b/.test(
      n,
    )
  );
}
export function readAbacusVoiceSharing() {
  try {
    return typeof localStorage === "undefined"
      ? false
      : localStorage.getItem(KEY) !== "false";
  } catch {
    return false;
  }
}
export function setAbacusVoiceSharing(allowed: boolean) {
  try {
    localStorage.setItem(KEY, String(allowed));
  } catch {}
}
