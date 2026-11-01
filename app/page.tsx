import JarvisExperience from "./components/JarvisExperience";
export default function Home() {
  return <JarvisExperience experimentalGemini={process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "experiment/gemini-live-hybrid"} />;
}
