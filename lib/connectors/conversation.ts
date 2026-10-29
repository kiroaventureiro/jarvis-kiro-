import "server-only";
import { connectors, connectorStore } from "./server";
import { conversationalConnectorRead as read } from "./conversation-core";
export const conversationalConnectorRead = (
  message: string,
  history: import("./read-context").ReadTurn[] = [],
  signal?: AbortSignal,
) => read(message, { connectors, connectorStore }, history, signal);
