import "server-only";
import { listPersistentProjects } from "../workspace/projects";

/** Explicitly requested project only. Never include secrets, notes or external task IDs. */
export async function naviProjectContext(question: string): Promise<string | null> {
  const match = /(?:projeto|project)\s+["“]?([\p{L}\p{N}_ -]{2,100})["”]?/iu.exec(question);
  if (!match) return null;
  const requested = match[1].trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const projects = await listPersistentProjects();
  const matches = projects.filter(p => p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === requested);
  if (matches.length !== 1) return null;
  const p = matches[0];
  return JSON.stringify({
    name:p.name.slice(0,100), status:p.status,
    objective:p.objective.slice(0,600), nextStep:p.nextStep.slice(0,300),
    updatedAt:p.updatedAt,
  });
}
