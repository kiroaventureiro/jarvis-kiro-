import { operationalSnapshot } from "./operational/server";
import "server-only";
import catalog from "../config/integration-catalog.json";

/** Preparation is NOT live access. This module never reveals a secret or calls third-party services. */
const envRequirements: Record<string, string[]> = {
  GitHub: ["GITHUB_READ_TOKEN"],
  Vercel: ["VERCEL_API_TOKEN"],
  "OpenAI voice": ["OPENAI_API_KEY"],
  "Google Drive/Gmail/Calendar": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  "Microsoft OneDrive/Outlook": [
    "MICROSOFT_CLIENT_ID",
    "MICROSOFT_CLIENT_SECRET",
  ],
  n8n: ["N8N_BASE_URL", "N8N_API_KEY"],
  "OBS/KIRO TV Windows Agent": [
    "WINDOWS_AGENT_BASE_URL",
    "WINDOWS_AGENT_SHARED_SECRET",
  ],
  "YouTube/Instagram/TikTok": [],
  "Supabase Jarvis": ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  "Supabase legado Sistema Origem": [],
};
export function getIntegrationReadiness(snapshot = operationalSnapshot()) {
  return catalog.connections.map((entry) => {
    const current = snapshot.integrations.find(
      (item) =>
        item.name === entry.name ||
        (entry.name === "Supabase Jarvis" && item.id === "supabase-memory"),
    );
    const native = current?.note.startsWith("Conector nativo") === true;
    const required = native ? [] : (envRequirements[entry.name] ?? []);
    const missing = required.filter((key) => !process.env[key]?.trim());
    return {
      name: entry.name,
      purpose: entry.purpose,
      priority: entry.priority,
      plannedMode: entry.mode,
      credentialNamesRequired: required,
      credentialNamesMissing: missing,
      configPresent:
        current?.configured === true ||
        (required.length > 0 && missing.length === 0),
      liveConnectionVerified: current?.verified === true,
      operational: current || null,
      status:
        current?.state ||
        (missing.length
          ? "requires_configuration"
          : "awaiting_live_validation"),
      note: "Configuração, validação e autorização são distintas; consulte a evidência operacional datada.",
    };
  });
}
