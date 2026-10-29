/** Centralized WebAuthn relying-party settings. No public enrollment is enabled. */
export type PasskeyConfig = { rpID: string; origin: string; rpName: string };
export function getPasskeyConfig(env: NodeJS.ProcessEnv = process.env): PasskeyConfig {
  const origin = env.JARVIS_WEBAUTHN_ORIGIN;
  const rpID = env.JARVIS_WEBAUTHN_RP_ID;
  if (!origin || !rpID) throw new Error("Passkey configuration is missing");
  const url = new URL(origin);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !["https:", "http:"].includes(url.protocol))
    throw new Error("Invalid WebAuthn origin");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))
    throw new Error("WebAuthn requires HTTPS (except localhost)");
  if (origin !== url.origin) throw new Error("WebAuthn origin must be canonical");
  if (rpID.includes(":") || rpID.includes("/") || !(url.hostname === rpID || url.hostname.endsWith("." + rpID)))
    throw new Error("WebAuthn RP ID does not match the origin");
  if (url.hostname === "localhost" && rpID !== "localhost") throw new Error("Invalid localhost RP ID");
  return { origin, rpID, rpName: "Jarvis Kiro" };
}
