/** Public documentation snapshot; never represents account entitlements or live credit balance. */
export const ABACUS_CAPABILITIES = {
  reviewedAt: "2026-10-28",
  source: "https://abacus.ai/help/route-llm/",
  defaultModel: "route-llm",
  modelSelection: "automatic_route_llm",
  text: {
    implemented: true,
    streaming: true,
    history: "bounded_session",
    projectContext: "curated_index",
  },
  images: {
    documented: true,
    implemented: true,
    generationTested: false,
    authorizationRequired: true,
  },
  audio: {
    documented: true,
    implemented: true,
    generationTested: false,
    authorizationRequired: true,
    browserVoicePreserved: true,
  },
  video: {
    documentedCatalog: true,
    implemented: false,
    entitlementVerified: false,
    authorizationRequired: true,
  },
  externalTools: {
    implemented: false,
    discoveryImplemented: true,
    automaticExecution: false,
  },
  liveWeb: {
    implemented: true,
    requiresExplicitToolBudget: true,
    accountEntitlementVerified: false,
    source: "https://api.abacus.ai/help/route-llm/responses",
  },
  billing: {
    metered: true,
    chatllmUnlimitedDoesNotImplyFreeApi: true,
    creditsAvailable: null,
  },
  accountPlan: "not_queried_by_server",
} as const;
