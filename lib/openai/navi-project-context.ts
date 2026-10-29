import "server-only";
import { listPersistentProjects } from "../workspace/projects";

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Read-only, explicit project reference; never send notes, external IDs or credentials. */
export async function naviProjectContext(question: string): Promise<string | null> {
  if (!/\b(?:projeto|project)\b/i.test(normalize(question))) return null;
  const projects = await listPersistentProjects();
  const normalized = normalize(question);
  const matches = projects.filter((p) => {
    const name = normalize(p.name);
    if (name.length < 2) return false;
    // Project names must be bounded, not substrings of unrelated names.
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ref = new RegExp("(?:^|\\W)(?:projeto|project)\\s+[\\\"“]?" + escaped + "(?=$|[\\\"”.,!?;:]|\\s+(?:para|que|e|com|sobre|no|na|do|da)\\b)", "i");
    return ref.test(normalized);
  });
  if (matches.length !== 1) return null;
  const p = matches[0];
  return JSON.stringify({
    name: p.name.slice(0, 100),
    status: p.status,
    objective: p.objective.slice(0, 600),
    nextStep: p.nextStep.slice(0, 300),
    updatedAt: p.updatedAt,
  });
}
