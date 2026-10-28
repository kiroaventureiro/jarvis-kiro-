import "server-only";
import { connectors, connectorStore } from "./server";
import { conversationalConnectorRead as read } from "./conversation-core";
export const conversationalConnectorRead = (message: string) =>
  read(message, { connectors, connectorStore });
