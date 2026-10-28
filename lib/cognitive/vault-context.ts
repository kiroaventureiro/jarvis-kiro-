import type { StateStore } from "../connectors/types";
import type { CognitiveContext, QueryRecord } from "./types";
export type StoredConversation = {
  expires: number;
  generation: number;
  context: CognitiveContext;
};
/** Existing dedicated encrypted connector vault; no new table or credential. */
export class VaultContexts {
  constructor(
    private store: StateStore,
    private now = () => Date.now(),
  ) {}
  async begin(key: string) {
    return this.store.update((state) => {
      const entries = state.cognitive || {};
      for (const [k, v] of Object.entries(entries))
        if (v.expires <= this.now()) delete entries[k];
      if (!entries[key]) {
        while (Object.keys(entries).length >= 12) {
          const oldest = Object.keys(entries).sort(
            (a, b) => entries[a].expires - entries[b].expires,
          )[0];
          delete entries[oldest];
        }
        entries[key] = {
          expires: this.now() + 1800000,
          generation: 0,
          context: { records: [] },
        };
      }
      const v = entries[key];
      v.generation++;
      v.expires = this.now() + 1800000;
      state.cognitive = entries;
      return { context: structuredClone(v.context), generation: v.generation };
    });
  }
  async commit(key: string, generation: number, record: QueryRecord) {
    return this.store.update((state) => {
      const v = state.cognitive?.[key];
      if (!v || v.expires <= this.now() || v.generation !== generation)
        return false;
      const records = [...v.context.records, structuredClone(record)].slice(-6);
      while (JSON.stringify(records).length > 70000 && records.length > 1)
        records.shift();
      v.context = {
        records,
        selection: record.selection,
        depth: record.intent.depth,
      };
      return true;
    });
  }
}
