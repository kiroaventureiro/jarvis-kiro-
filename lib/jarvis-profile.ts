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
export function getIntegrationStatus() {
  return catalog.connections.map(({name,purpose,priority,mode,status}) => ({
    name,purpose,priority,mode,status,
    connected: false, // An inventory entry is not a live authorized connection.
  }));
}
