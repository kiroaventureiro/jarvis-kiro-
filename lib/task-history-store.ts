import "server-only";
import type { TaskRecord } from "./task-memory-policy";
export type HistoryEvent={eventId:string;taskId:string;at:string;type:"created"|"status_changed"|"approval_requested"|"error";status:string};
export type HistoryPage={records:TaskRecord[];nextCursor:string|null;source:"persistent_store"};
export interface TaskHistoryStore {
  list(context:"personal"|"kiro",cursor?:string,limit?:number):Promise<HistoryPage>;
  get(taskId:string):Promise<TaskRecord|null>;
  createIfAbsent(task:TaskRecord):Promise<{created:boolean;record:TaskRecord}>;
  appendEvent(event:HistoryEvent):Promise<void>;
}
export class UnconfiguredTaskStore implements TaskHistoryStore {
 private unavailable():never {throw new Error("TASK_STORAGE_NOT_CONFIGURED");}
 async list():Promise<HistoryPage>{return this.unavailable();}
 async get():Promise<TaskRecord|null>{return this.unavailable();}
 async createIfAbsent():Promise<{created:boolean;record:TaskRecord}>{return this.unavailable();}
 async appendEvent():Promise<void>{return this.unavailable();}
}
export function getTaskHistoryStore():TaskHistoryStore {
 // A real encrypted persistent adapter must be explicitly installed here.
 return new UnconfiguredTaskStore();
}
