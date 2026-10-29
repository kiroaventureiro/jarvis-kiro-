import { requestedProject, type ProjectResource } from "./project-selection";
import { isReadFollowup } from "./read-intent";
export { isReadFollowup, selfDiagnosticIntent } from "./read-intent";
export type ReadTurn = { role: "user" | "assistant"; content: string };
const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const providers = (s: string) => {
  const n = normalized(s);
  return [
    /\b(github|git hub|commits?|branches|issues|pulls|pull requests)\b/.test(n)
      ? "github"
      : "",
    /\b(vercel|versel|deploys?|deployments)\b/.test(n) ? "vercel" : "",
    /\b(supabase|supa base)\b/.test(n) ? "supabase" : "",
  ].filter(Boolean);
};
/** History resolves identity only, never authority, operations or tool arguments. */
export function contextualReadMessage(
  message: string,
  resources: ProjectResource[],
  history: ReadTurn[] = [],
) {
  if (!isReadFollowup(message)) return message;
  const explicit = requestedProject(message, resources);
  if (
    explicit.kind === "target" ||
    /^(?:e|quanto a)\s+(?:o|a)\s+(?!(?:status|situacao|resultado|historico|diagnostico|repositorio|projeto|site|vercel|github|supabase)\b)[\w-]{4,}/.test(
      normalized(message).trim(),
    ) ||
    /\b(?:projeto|repositorio|site)\s+(?!dele\b|dela\b)[\w-]{4,}/.test(
      normalized(message),
    )
  )
    return message;
  let inheritedProvider: string[] = [];
  for (const turn of history.slice(-12).reverse()) {
    if (
      turn.role !== "user" ||
      !turn.content.trim() ||
      turn.content === message
    )
      continue;
    const previous = turn.content.slice(0, 600);
    if (!inheritedProvider.length) inheritedProvider = providers(previous);
    const selected = requestedProject(previous, resources);
    if (selected.kind === "target") {
      const service = providers(message).length ? [] : inheritedProvider;
      return (
        message +
        " · projeto " +
        selected.name +
        (service.length ? " · " + service.join(" e ") : "")
      );
    }
    if (!isReadFollowup(previous)) break;
  }
  return message;
}
