import type { ProjectSelection } from "../connectors/project-selection";
export type Depth = "brief" | "normal" | "detailed" | "deep";
export type Intent = {
  goal: "query" | "diagnose" | "recall" | "compare" | "modify" | "explain";
  providers: string[];
  depth: Depth;
  refresh: boolean;
  followUp: boolean;
  all: boolean;
};
export type ToolResource = {
  id: string;
  name: string;
  kiroProject?: string;
  defaultBranch?: string;
};
export type Availability = {
  connected: boolean;
  read: boolean;
  resources: ToolResource[];
};
export type Observation = {
  summary: string;
  signals: string[];
  limits: string[];
  facts: Record<string, number | string | boolean>;
};
export type Capability = {
  id: string;
  provider: string;
  operation: string;
  aliases: string[];
  purpose: "overview" | "inspect";
  effect: "read" | "write";
  permission: string;
  cost: "no_model_call";
  timeoutMs: number;
  maxCalls: number;
  validate: (args: Record<string, unknown>) => boolean;
  inspect: (data: unknown) => Observation;
};
export type Evidence = {
  id: string;
  provider: string;
  resource: string;
  resourceName: string;
  projectId?: string;
  operation: string;
  at: string;
  status: "verified" | "failed" | "unverified";
  category?: string;
  observation: Observation;
};
export type QueryRecord = {
  id: string;
  at: string;
  intent: Intent;
  selection: ProjectSelection;
  evidence: Evidence[];
  limits: string[];
};
export type CognitiveContext = {
  records: QueryRecord[];
  selection?: ProjectSelection;
  depth?: Depth;
};
export type ToolCall = {
  capability: string;
  resource: string;
  args: Record<string, unknown>;
};
export type SemanticProposal = {
  goal?: Intent["goal"];
  providers?: string[];
  depth?: Depth;
  project?: string;
};
export type SemanticPlanner = (
  message: string,
  catalog: Array<{ id: string; provider: string; operation: string }>,
  signal: AbortSignal,
) => Promise<SemanticProposal | null>;
export type CognitiveDependencies = {
  catalog: import("./registry").CapabilityRegistry;
  available: () => Promise<Record<string, Availability>>;
  execute: (
    provider: string,
    resource: string,
    operation: string,
    args: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<{ data: unknown; checkedAt?: string }>;
  now?: () => number;
  semantic?: SemanticPlanner;
};
