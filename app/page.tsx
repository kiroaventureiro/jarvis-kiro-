import JarvisExperience from "./components/JarvisExperience";

export default function Home() {
  const budget = Number(process.env.JARVIS_GEMINI_LIVE_MAX_CALLS_PER_HOUR);
  const experimentalGemini =
    process.env.VERCEL_ENV === "preview" &&
    process.env.JARVIS_GEMINI_LIVE_ENABLED === "true" &&
    process.env.JARVIS_GEMINI_LIVE_PAID_ALLOWED === "true" &&
    Number.isInteger(budget) &&
    budget >= 1 &&
    budget <= 120;

  return <JarvisExperience experimentalGemini={experimentalGemini} />;
}
