import "server-only";
import { randomUUID } from "node:crypto";
import { connectorStore } from "../connectors/server";
import type { PersistentProject } from "../connectors/types";

const stringField = (value: unknown, max = 500) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max
    ? value.trim() : null;

export async function listPersistentProjects() {
  const state = await connectorStore.read();
  return Object.values(state.persistentProjects || {})
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 100);
}

export async function savePersistentProject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("INVALID_PROJECT");
  const v = input as Record<string, unknown>;
  const name = stringField(v.name, 100);
  const objective = stringField(v.objective, 1000);
  const provider = stringField(v.provider, 80);
  const nextStep = stringField(v.nextStep, 500);
  const externalRef = v.externalRef === undefined ? undefined : stringField(v.externalRef, 200);
  const status = v.status === undefined ? "planned" : v.status;
  const rawTask = v.externalTask;
  let externalTask: PersistentProject["externalTask"] | undefined;
  if (rawTask !== undefined) {
    if (!rawTask || typeof rawTask !== "object" || Array.isArray(rawTask)) throw Error("INVALID_EXTERNAL_TASK");
    const task = rawTask as Record<string, unknown>;
    if (task.provider !== "abacus" || !["agent", "task", "workflow", "media"].includes(String(task.kind)) ||
        typeof task.id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(task.id) ||
        task.verification !== undefined && task.verification !== "unverified")
      throw Error("INVALID_EXTERNAL_TASK");
    externalTask = {provider:"abacus",kind:task.kind as "agent" | "task" | "workflow" | "media",id:task.id,verification:"unverified"};
  }
  if (!name || !objective || !provider || !nextStep || (v.externalRef !== undefined && !externalRef) ||
      !["planned","active","paused","completed"].includes(String(status)) ||
      (v.id !== undefined && !stringField(v.id, 80)) ||
      (v.notes !== undefined && (!Array.isArray(v.notes) || v.notes.length > 20 ||
        !v.notes.every((note: unknown) => typeof note === "string" && note.length <= 500)))) throw Error("INVALID_PROJECT");
  const id = typeof v.id === "string" ? v.id : randomUUID();
  const now = new Date().toISOString();
  return connectorStore.update(state => {
    const records = state.persistentProjects || (state.persistentProjects = {});
    const previous = records[id];
    if (!previous && Object.keys(records).length >= 100) throw Error("PROJECT_LIMIT");
    const project: PersistentProject = {
      id, name, objective, provider, nextStep, status: status as PersistentProject["status"],
      ...(externalRef ? {externalRef} : previous?.externalRef ? {externalRef: previous.externalRef} : {}),
      ...(externalTask ? { externalTask } : previous?.externalTask ? { externalTask: previous.externalTask } : {}),
      notes: Array.isArray(v.notes) ? v.notes as string[] : previous?.notes || [],
      createdAt: previous?.createdAt || now, updatedAt: now,
    };
    records[id] = project;
    state.audit.push({id: randomUUID(), at: now, operation: "workspace.project.save",
      resource: id, outcome: previous ? "updated" : "created"});
    return project;
  });
}
