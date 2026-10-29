import type { CognitiveContext, QueryRecord } from "./types";
/** Ephemeral, bounded, server-side state. No raw tool output, credentials or user transcript. */
export class ConversationContexts {
  private entries = new Map<
    string,
    { expires: number; generation: number; context: CognitiveContext }
  >();
  constructor(
    private now = () => Date.now(),
    private ttl = 1800000,
    private max = 100,
  ) {}
  begin(key: string) {
    for (const [k, v] of this.entries)
      if (v.expires <= this.now()) this.entries.delete(k);
    let v = this.entries.get(key);
    if (!v) {
      while (this.entries.size >= this.max)
        this.entries.delete(this.entries.keys().next().value!);
      v = {
        expires: this.now() + this.ttl,
        generation: 0,
        context: { records: [] },
      };
      this.entries.set(key, v);
    }
    v.generation++;
    v.expires = this.now() + this.ttl;
    return { context: structuredClone(v.context), generation: v.generation };
  }
  commit(key: string, generation: number, record: QueryRecord) {
    const v = this.entries.get(key);
    if (!v || v.expires <= this.now() || v.generation !== generation)
      return false;
    v.context = {
      records: [...v.context.records, structuredClone(record)].slice(-6),
      selection: record.selection,
      depth: record.intent.depth,
    };
    return true;
  }
  clear(key: string) {
    this.entries.delete(key);
  }
}

export interface ContextStore {
  begin(
    key: string,
  ):
    | { context: CognitiveContext; generation: number }
    | Promise<{ context: CognitiveContext; generation: number }>;
  commit(
    key: string,
    generation: number,
    record: QueryRecord,
  ): boolean | Promise<boolean>;
}
