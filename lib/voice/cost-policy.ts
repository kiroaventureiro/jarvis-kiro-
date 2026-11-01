export type MeteredProvider = "abacus" | "openai-voice";
export type CostPermission = { allowed: boolean; callsPerHour: number };
export function costPermission(
  provider: MeteredProvider,
  env: Record<string, string | undefined>,
): CostPermission {
  const prefix =
    provider === "abacus" ? "JARVIS_ABACUS" : "JARVIS_OPENAI_VOICE";
  const count = Number(env[prefix + "_MAX_CALLS_PER_HOUR"]);
  return {
    allowed:
      env[prefix + "_PAID_ALLOWED"] === "true" &&
      Number.isInteger(count) &&
      count > 0 &&
      count <= 120,
    callsPerHour:
      Number.isInteger(count) && count > 0 ? Math.min(count, 120) : 0,
  };
}
export class ProviderCallBudget {
  private windows = new Map<
    MeteredProvider,
    { since: number; calls: number; recent: number[] }
  >();
  admit(
    provider: MeteredProvider,
    permission: CostPermission,
    now = Date.now(),
  ) {
    if (!permission.allowed)
      return {
        allowed: false,
        reason:
          "Uso pago bloqueado. É necessária autorização e um limite de chamadas configurado no servidor.",
      };
    let item = this.windows.get(provider);
    if (!item || now - item.since >= 3600000) {
      item = { since: now, calls: 0, recent: [] };
      this.windows.set(provider, item);
    }
    item.recent = item.recent.filter((at) => now - at < 60000);
    if (item.calls >= permission.callsPerHour || item.recent.length >= 6)
      return {
        allowed: false,
        reason:
          "Limite de chamadas atingido. Aguarde antes de tentar novamente.",
      };
    item.calls++;
    item.recent.push(now);
    return { allowed: true, reason: "" };
  }
  available(
    provider: MeteredProvider,
    permission: CostPermission,
    now = Date.now(),
  ) {
    if (!permission.allowed) return false;
    const item = this.windows.get(provider);
    return (
      !item ||
      now - item.since >= 3600000 ||
      (item.calls < permission.callsPerHour &&
        item.recent.filter((at) => now - at < 60000).length < 6)
    );
  }
  stats(provider: MeteredProvider, now = Date.now()) {
    const item = this.windows.get(provider);
    if (item && now - item.since >= 3600000) this.windows.delete(provider);
    return {
      calls: this.windows.get(provider)?.calls || 0,
      scope: "server_instance",
      persistent: false,
      creditsAvailable: null,
    };
  }
}
export const providerCallBudget = new ProviderCallBudget();
