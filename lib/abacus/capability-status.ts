/**
 * Abacus capability inventory for Jarvis Kiro.
 *
 * This module is pure and performs NO network requests, billing,
 * authorization, or discovery. Server-side authenticated probes may
 * populate the evidence in a separate integration.
 */
export const ABACUS_CAPABILITIES = [
  "chat_streaming",
  "persistent_conversation",
  "agent_execution",
  "connected_tools",
  "provider_memory",
] as const;

export type AbacusCapability = (typeof ABACUS_CAPABILITIES)[number];
export type CapabilityEvidence = {
  /** Whether public documentation/catalog describes the capability. */
  documented: boolean;
  /** Whether user-scoped authorization for this particular feature was confirmed. */
  authorized: boolean;
  /** Whether an authenticated, non-billable check established API availability. */
  apiAvailable: boolean;
  /** Whether the feature has been validated end-to-end in Jarvis. */
  verified: boolean;
  /** ISO 8601 time of the last valid check. */
  checkedAt?: string;
};

export type CapabilityStage =
  | "unknown"
  | "documented"
  | "authorized"
  | "api_available"
  | "verified";

export function capabilityStage(evidence?: CapabilityEvidence): CapabilityStage {
  if (!evidence) return "unknown";
  if (evidence.verified && evidence.apiAvailable && evidence.authorized) return "verified";
  if (evidence.apiAvailable && evidence.authorized) return "api_available";
  if (evidence.authorized) return "authorized";
  return evidence.documented ? "documented" : "unknown";
}

export type CapabilityReport = Record<AbacusCapability, {
  stage: CapabilityStage;
  checkedAt?: string;
}>;

/** Missing evidence must never be shown as a verified integration. */
export function buildAbacusCapabilityReport(
  evidence: Partial<Record<AbacusCapability, CapabilityEvidence>> = {},
): CapabilityReport {
  const report = {} as CapabilityReport;
  for (const capability of ABACUS_CAPABILITIES) {
    report[capability] = {
      stage: capabilityStage(evidence[capability]),
      ...(evidence[capability]?.checkedAt ? { checkedAt: evidence[capability]!.checkedAt } : {}),
    };
  }
  return report;
}

/** Fail closed: do not execute a capability unless it passed every verification stage. */
export function canUseAbacusCapability(
  report: CapabilityReport,
  capability: AbacusCapability,
  now: number = Date.now(),
  maxAgeMs: number = 15 * 60 * 1000,
): boolean {
  const record = report[capability];
  if (record?.stage !== "verified" || !record.checkedAt) return false;
  const checkedAt = Date.parse(record.checkedAt);
  if (!Number.isFinite(checkedAt) || !Number.isFinite(now)) return false;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return false;
  // Fail closed for stale evidence or timestamps set in the future.
  return checkedAt <= now && now - checkedAt <= maxAgeMs;
}
