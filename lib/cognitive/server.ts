import { VaultContexts } from "./vault-context";
import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cookieName, valid } from "../auth";
import { connectors, connectorStore } from "../connectors/server";
import type { Provider } from "../connectors/types";
import { CognitiveEngine, validateProposal } from "./engine";
import { createNativeCatalog } from "./native-catalog";
import { costPermission, providerCallBudget } from "../voice/cost-policy";
import { askAbacus } from "../abacus-routellm";
const catalog = createNativeCatalog();
const engine = new CognitiveEngine(
  {
    catalog,
    available: async () => {
      if (!connectorStore.configured()) return {};
      const state = await connectorStore.read();
      return Object.fromEntries(
        ["github", "vercel", "supabase"].map((p) => {
          const c = state.connections[p as Provider];
          return [
            p,
            {
              connected: c?.status === "connected",
              read: !!c?.grants.includes("read"),
              resources: c?.resources || [],
            },
          ];
        }),
      );
    },
    execute: (p, r, o, a, signal) =>
      connectors.readAuthorized(p as Provider, r, o, a, signal),
    semantic: async (message, capabilities, signal) => {
      // Semantic interpretation uses only the existing authorized Abacus budget; explicit false disables it.
      if (
        process.env.JARVIS_COGNITIVE_SEMANTIC_ENABLED === "false" ||
        !process.env.ABACUS_API_KEY
      )
        return null;
      const permission = costPermission("abacus", process.env);
      if (
        !permission.allowed ||
        !providerCallBudget.admit("abacus", permission).allowed
      )
        return null;
      try {
        const result = await askAbacus(message, signal, {
          classification: capabilities,
        });
        if (result.truncated) return null;
        return validateProposal(
          JSON.parse(
            result.text.replace(/^\x60{3}(?:json)?\s*|\s*\x60{3}$/g, ""),
          ),
          [...new Set(capabilities.map((c) => c.provider))],
        );
      } catch {
        return null;
      }
    },
  },
  new VaultContexts(connectorStore),
);
export async function answerCognitiveRequest(
  message: string,
  signal?: AbortSignal,
  localOnly = false,
) {
  const value = (await cookies()).get(cookieName)?.value;
  if (!valid(value)) return null;
  const key = createHash("sha256").update(value!).digest("hex");
  return engine.answer(message, key, signal, { semantic: !localOnly });
}
