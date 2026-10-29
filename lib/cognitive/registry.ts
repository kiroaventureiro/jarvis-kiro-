import type { Capability, ToolCall, Availability } from "./types";
export class CapabilityRegistry {
  private entries = new Map<string, Capability>();
  register(c: Capability) {
    if (
      this.entries.has(c.id) ||
      !c.id ||
      !c.provider ||
      c.timeoutMs < 1 ||
      c.timeoutMs > 15000 ||
      c.maxCalls < 1 ||
      c.maxCalls > 8
    )
      throw Error("CAPABILITY_INVALID");
    this.entries.set(c.id, Object.freeze({ ...c, aliases: [...c.aliases] }));
    return this;
  }
  list() {
    return [...this.entries.values()];
  }
  aliases() {
    const aliases: Record<string, string[]> = {};
    for (const c of this.list())
      aliases[c.provider] = [
        ...new Set([...(aliases[c.provider] || []), c.provider, ...c.aliases]),
      ];
    return aliases;
  }
  validate(call: ToolCall, available: Record<string, Availability>) {
    const c = this.entries.get(call.capability);
    if (!c || c.effect !== "read" || c.permission !== "read")
      throw Error("APPROVAL_REQUIRED");
    const a = available[c.provider];
    if (
      !a?.connected ||
      !a.read ||
      !a.resources.some((r) => r.id === call.resource)
    )
      throw Error("SCOPE_DENIED");
    if (!c.validate(call.args)) throw Error("ARGS_INVALID");
    return c;
  }
}
