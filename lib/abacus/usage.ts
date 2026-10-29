import { AbacusError, type TokenUsage } from "./protocol";
export class AbacusUsageLedger {
  private since = 0;
  private sequence = 0;
  private pending = new Map<number, number>();
  private totals = {
    attempts: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    unknownUsage: 0,
    unverifiedReservedTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
  };
  private byModel: Record<string, number> = Object.create(null);
  private reset(now: number) {
    if (!this.since || now - this.since >= 3600000) {
      this.since = now;
      this.pending.clear();
      this.totals = {
        attempts: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        unknownUsage: 0,
        unverifiedReservedTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
      };
      this.byModel = Object.create(null);
    }
  }
  begin(reservation: number, limit = 60000, now = Date.now()) {
    this.reset(now);
    const reserved = [...this.pending.values()].reduce((a, b) => a + b, 0);
    if (
      this.totals.totalTokens +
        this.totals.unverifiedReservedTokens +
        reserved +
        reservation >
      limit
    )
      throw new AbacusError("ABACUS_BUDGET", 429);
    const id = ++this.sequence;
    this.pending.set(id, reservation);
    this.totals.attempts++;
    return id;
  }
  finish(
    id: number,
    usage: TokenUsage | null,
    model: string,
    outcome: "completed" | "failed" | "cancelled",
  ) {
    const reserved = this.pending.get(id);
    if (reserved === undefined) return;
    this.pending.delete(id);
    this.totals[outcome]++;
    if (usage) {
      this.totals.promptTokens += usage.promptTokens;
      this.totals.completionTokens += usage.completionTokens;
      this.totals.cachedTokens += usage.cachedTokens;
      this.totals.totalTokens += usage.totalTokens;
    } else {
      this.totals.unknownUsage++;
      this.totals.unverifiedReservedTokens += reserved;
    }
    if (
      outcome === "completed" &&
      model &&
      Object.keys(this.byModel).length < 20
    )
      this.byModel[model.slice(0, 100)] =
        (this.byModel[model.slice(0, 100)] || 0) + 1;
  }
  stats(now = Date.now()) {
    this.reset(now);
    return {
      ...this.totals,
      reservedTokens: [...this.pending.values()].reduce((a, b) => a + b, 0),
      models: { ...this.byModel },
      windowStartedAt: new Date(this.since).toISOString(),
      scope: "server_instance",
      persistent: false,
      costUsd: null,
      creditsAvailable: null,
      note: "Tokens informados pelo provedor; sem usage, a reserva conservadora é debitada no limite local. Não equivale a créditos ou fatura.",
    };
  }
}
export const abacusUsage = new AbacusUsageLedger();
export function tokenLimit(env: Record<string, string | undefined>) {
  const n = Number(env.JARVIS_ABACUS_MAX_TOKENS_PER_HOUR);
  return Number.isInteger(n) && n >= 1000 && n <= 1000000 ? n : 60000;
}
