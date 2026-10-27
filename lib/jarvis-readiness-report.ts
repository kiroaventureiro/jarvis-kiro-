import "server-only";
import { operationalSnapshot } from "./operational/server";
import inventory from "../config/kiro-ecosystem-inventory.json";
import { N8N_WORKFLOWS } from "./n8n-workflow-registry";
import { AGENT_TRANSPORT } from "./agent-transport-contract";
import { TASK_RETENTION } from "./task-memory-policy";
export function getJarvisReadinessReport() {
  const operational = operationalSnapshot();
  return {
    stage: "architecture_before_authorization",
    generatedAt: new Date().toISOString(),
    productionReleaseApproved: false,
    operational,
    ecosystem: {
      cataloguedServices: inventory.services.length,
      liveConnectionsVerified: operational.integrations.filter(
        (s) => s.verified,
      ).length,
      services: inventory.services.map((s) => {
        const current = operational.integrations.find(
          (item) =>
            item.name === s.name ||
            (s.name === "Supabase" && item.id === "supabase-memory"),
        );
        return {
          name: s.name,
          category: s.category,
          stage: current?.state || "planned",
          authorized: current?.authorized === true,
          verified: current?.verified === true,
          operational: current || null,
        };
      }),
    },
    automation: {
      registeredWorkflows: Object.keys(N8N_WORKFLOWS).length,
      n8nConnected: operational.integrations.some(
        (s) => s.id === "n8n" && s.verified,
      ),
      executionEnabled: false,
    },
    windows: {
      agentInstalledVerified: false,
      transportEnabled: AGENT_TRANSPORT.enabled,
      remoteExecutionEnabled: false,
    },
    memory: {
      historicalIndexPrepared: true,
      persistentTaskStoreConnected: false,
      taskMetadataRetentionDays: TASK_RETENTION.keepTaskMetadataDays,
    },
    outstanding: [
      "OAuth e credenciais isoladas por provedor",
      "conector n8n com autenticação e prevenção de replay",
      "agente Windows instalado e autorizado",
      "armazenamento persistente criptografado de tarefas",
      "testes de integração e dispositivos",
    ],
    disclaimer:
      "Planos de arquitetura são distintos da evidência operacional datada. Consulte operational para o ambiente atual; memória de tarefas e histórico do proprietário são capacidades distintas.",
  };
}
