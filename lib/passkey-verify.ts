import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { getPasskeyConfig } from "./passkey-config";

/**
 * Trusted data must come from a server-side store, never from the browser body.
 * A challenge must be atomically marked as consumed in the database BEFORE
 * invoking these helpers. The API route must fail closed on database errors.
 */
export async function verifyNewDevice(
  response: RegistrationResponseJSON,
  challengeFromServer: string,
) {
  const { origin, rpID } = getPasskeyConfig();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeFromServer,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) throw new Error("Device registration rejected");
  return result.registrationInfo.credential;
}

export async function verifyKnownDevice(
  response: AuthenticationResponseJSON,
  challengeFromServer: string,
  storedCredential: WebAuthnCredential,
) {
  const { origin, rpID } = getPasskeyConfig();
  if (response.id !== storedCredential.id) throw new Error("Credential mismatch");
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeFromServer,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: storedCredential,
    requireUserVerification: true,
  });
  if (!result.verified) throw new Error("Passkey authentication rejected");
  return result.authenticationInfo.newCounter;
}
