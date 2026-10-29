import { operationalSnapshot } from "./operational/server";
import "server-only";
import personality from "../config/jarvis-personality.json";
import catalog from "../config/integration-catalog.json";

/** Live application reads versioned guidance; catalog never grants permissions. */
export function getJarvisProfile() {
  return {
    identity: personality.identity,
    voice: personality.voice,
    principles: personality.principles,
    authority: personality.authority,
    interaction: personality.interaction,
  };
}
export function getIntegrationStatus(snapshot = operationalSnapshot()) {
  const find = (name: string) =>
    snapshot.integrations.find(
      (item) =>
        item.name === name ||
        (name === "Supabase Jarvis" && item.id === "supabase-memory"),
    );
  const rows = catalog.connections.map(
    ({ name, purpose, priority, mode, status }) => {
      const current = find(name);
      return {
        name,
        purpose,
        priority,
        mode,
        inventoryStatus: status,
        status: current?.state || "not_configured",
        configured: current?.configured || false,
        connected: current?.verified === true,
        operational: current || null,
        note: "Estado não verificado não equivale a desconexão comprovada.",
      };
    },
  );
  return [
    ...rows,
    {
      name: "Abacus RouteLLM",
      purpose: "Conversa autenticada e roteamento",
      priority: "P0",
      mode: "server-mediated",
      inventoryStatus: "runtime_registry",
      status: snapshot.integrations[0].state,
      configured: snapshot.integrations[0].configured,
      connected: snapshot.integrations[0].verified,
      operational: snapshot.integrations[0],
      note: "Fonte: registro operacional deste ambiente.",
    },
  ];
}
