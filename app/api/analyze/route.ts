import { authorized } from "../../../lib/auth";
import { getJarvisProfile } from "../../../lib/jarvis-profile";
import { createAnalysisHandler } from "../../../lib/attachment-analysis";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const POST = createAnalysisHandler({
  authorized,
  key: () => process.env.OPENAI_API_KEY,
  model: () => process.env.JARVIS_ANALYSIS_MODEL || "gpt-4.1-mini",
  instructions: () => {
    const profile = getJarvisProfile();
    return [
      "Você é " + profile.identity.name,
      profile.identity.role,
      ...profile.principles,
      "Ações que exigem aprovação: " +
        profile.authority.approvalRequired.join("; "),
    ].join("\n");
  },
  fetcher: (...args) => fetch(...args),
});
