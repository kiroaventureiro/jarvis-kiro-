export const PROVIDERS = ["github", "supabase", "vercel"] as const;
export type Provider = (typeof PROVIDERS)[number];
export type Grant = "read" | "write" | "deploy" | "configure";
export type Resource = {
  id: string;
  name: string;
  environment: "development" | "preview" | "production";
  defaultBranch?: string;
  repoId?: number;
  teamId?: string;
  kiroProject?: string;
};
export type Credentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  configurationId?: string;
  teamId?: string;
  tokenId?: string;
};
export type Connection = {
  id: string;
  provider: Provider;
  mode: "oauth" | "token";
  status: "connected" | "disconnected" | "revoking" | "revocation_pending";
  revision: number;
  credentials?: Credentials;
  resources: Resource[];
  grants: Grant[];
  providerScopes: string[];
  verifiedAt: string | null;
  lastTestAt?: string;
  lastReadAt?: string;
  lastReadOperation?: string;
  account: string;
  refreshLease?: string;
  lastError?: string;
};
export type Action = {
  provider: Provider;
  resource: string;
  operation: string;
  args: Record<string, unknown>;
};
export type Step = {
  action: Action;
  status: "pending" | "running" | "done" | "waiting" | "failed" | "uncertain";
  result?: unknown;
  error?: string;
  startedAt?: number;
};
export type Plan = {
  id: string;
  title: string;
  digest: string;
  createdAt: number;
  expiresAt: number;
  status:
    | "draft"
    | "approved"
    | "running"
    | "waiting"
    | "done"
    | "failed"
    | "cancelled"
    | "uncertain";
  connectionRevisions: Partial<Record<Provider, string>>;
  steps: Step[];
  approval?: { at: number; session: string; digest: string };
  results?: unknown[];
};
export type Audit = {
  id: string;
  at: string;
  provider?: Provider;
  operation: string;
  resource?: string;
  plan?: string;
  outcome: string;
  digest?: string;
};
export type OAuthPending = {
  provider: Provider;
  verifier: string;
  bindingHash: string;
  expiresAt: number;
  sessionExpires: number;
};
export type PersistentProject = {
  id: string;
  name: string;
  provider: string;
  externalRef?: string;
  externalTask?: {
    provider: "abacus";
    kind: "agent" | "task" | "workflow" | "media";
    id: string;
    verification: "unverified" | "verified";
    checkedAt?: string;
  };
  objective: string;
  status: "planned" | "active" | "paused" | "completed";
  nextStep: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
};
export type VaultState = {
  voiceUsage?: import("../voice/ledger").VoiceUsageState;
  persistentProjects?: Record<string, PersistentProject>;

  abacusObservation?: import("../abacus/hub").AccountObservation;
  cognitive?: Record<
    string,
    import("../cognitive/vault-context").StoredConversation
  >;
  version: 1;
  connections: Partial<Record<Provider, Connection>>;
  plans: Plan[];
  audit: Audit[];
  oauth: Record<string, OAuthPending>;
};
export interface StateStore {
  configured(): boolean;
  read(): Promise<VaultState>;
  update<T>(fn: (s: VaultState) => T): Promise<T>;
}
export type ProviderResponse = {
  data: unknown;
  untrusted: true;
  source: "live";
  checkedAt: string;
};
export type Call = (
  provider: Provider,
  credentials: Credentials,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<unknown>;
export class ConnectorError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const emptyState = (): VaultState => ({
  version: 1,
  connections: {},
  plans: [],
  audit: [],
  oauth: {},
});
