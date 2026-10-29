import "server-only";
import { randomUUID } from "node:crypto";
import { connectorStore } from "../connectors/server";
import { type VaultState } from "../connectors/types";
import { type CodexTaskRecord, type CodexTaskState, transitionCodexTask } from "./task-lifecycle";

type TaskState = VaultState & { codexTasks?: Record<string, CodexTaskRecord> };
const nowISO = () => new Date().toISOString();

/** Persist drafts in the existing encrypted vault with optimistic concurrency. */
export async function createCodexTask(input: { repository: string; branch: string; kind: "review" | "test" | "implement"; instruction: string }): Promise<CodexTaskRecord> {
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(input.repository) ||
      !/^[a-zA-Z0-9._\/-]{1,150}$/.test(input.branch) ||
      ["main","master"].includes(input.branch)) throw Error("INVALID_SCOPE");
  if (!["review", "test", "implement"].includes(input.kind) || !input.instruction.trim() || input.instruction.length > 1500) throw Error("INVALID_TASK");
  const id = randomUUID(), at = nowISO();
  return connectorStore.update((state) => {
    const s=state as TaskState;
    const records=s.codexTasks || (s.codexTasks={});
    if (Object.keys(records).length >= 100) throw Error("TASK_LIMIT");
    const record:CodexTaskRecord={id,state:"draft",repository:input.repository,branch:input.branch,kind:input.kind,instruction:input.instruction.trim(),createdAt:at,updatedAt:at};
    records[id]=record;
    return record;
  });
}
export async function updateCodexTask(
  id:string, next:CodexTaskState,
  evidence:{approvalVerified?:boolean;workerVerified?:boolean;resultReference?:string},
):Promise<CodexTaskRecord>{
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error("INVALID_ID");
  return connectorStore.update((state)=>{
    const record=(state as TaskState).codexTasks?.[id];
    if (!record) throw Error("TASK_NOT_FOUND");
    const updated=transitionCodexTask(record,next,evidence,nowISO());
    (state as TaskState).codexTasks![id]=updated;
    return updated;
  });
}
export async function getCodexTask(id:string):Promise<CodexTaskRecord|null>{
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return ((await connectorStore.read()) as TaskState).codexTasks?.[id] || null;
}
