import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** WebAuthn challenges are transient and must never be saved in plaintext. */
export function issueChallenge() {
  const challenge = randomBytes(32).toString("base64url");
  return { challenge, challengeHash: hashChallenge(challenge), expiresAt: new Date(Date.now() + 5 * 60_000).toISOString() };
}

export function hashChallenge(challenge: string) {
  return createHash("sha256").update(challenge, "utf8").digest("hex");
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !url.startsWith("https://")) throw new Error("Private challenge database not configured");
  return { url: url.replace(/\/$/, ""), key };
}

async function supabase(path: string, method: string, body: object) {
  const { url, key } = config();
  const response = await fetch(url + path, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Passkey challenge database unavailable");
  return response;
}

export async function saveChallenge(hash: string, purpose: "register" | "authenticate", expiresAt: string) {
  await supabase("/rest/v1/jarvis_webauthn_challenges", "POST", { challenge_hash: hash, purpose, expires_at: expiresAt });
}

export async function consumeChallenge(hash: string, purpose: "register" | "authenticate"): Promise<boolean> {
  const response = await supabase("/rest/v1/rpc/jarvis_consume_webauthn_challenge", "POST", { p_challenge_hash: hash, p_purpose: purpose });
  return (await response.json()) === true;
}
