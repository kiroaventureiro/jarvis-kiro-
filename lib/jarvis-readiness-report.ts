import "server-only";
import inventory from "../config/kiro-ecosystem-inventory.json";
import { N8N_WORKFLOWS } from "./n8n-workflow-registry";
import { AGENT_TRANSPORT } from "./agent-transport-contract";
import { TASK_RETENTION } from "./task-memory-policy";
export function getJarvisReadinessReport(){
 return {
  stage:"architecture_before_authorization",
  generatedAt:new Date().toISOString(),
  productionReleaseApproved:false,
  ecosystem:{cataloguedServices:inventory.services.length,liveConnectionsVerified:0,
    services:inventory.services.map(s=>({name:s.name,category:s.category,stage:"planned",authorized:false,verified:false}))},
  automation:{registeredWorkflows:Object.keys(N8N_WORKFLOWS).length,n8nConnected:false,executionEnabled:false},
  windows:{agentInstalledVerified:false,transportEnabled:AGENT_TRANSPORT.enabled,remoteExecutionEnabled:false},
  memory:{historicalIndexPrepared:true,persistentTaskStoreConnected:false,taskMetadataRetentionDays:TASK_RETENTION.keepTaskMetadataDays},
  outstanding:["OAuth e credenciais isoladas por provedor","conector n8n com autenticação e prevenção de replay",
   "agente Windows instalado e autorizado","armazenamento persistente criptografado","testes de integração e dispositivos"],
  disclaimer:"Relatório de prontidão do código, não é verificação de conectividade em tempo real."
 };
}
