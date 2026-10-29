import "server-only";
import inventory from "../config/kiro-ecosystem-inventory.json";
export function getEcosystemOverview() {
 const services=inventory.services.map(s=>({
  name:s.name,category:s.category,purpose:s.purpose,
  connectionStrategy:s.connectionStrategy,
  stage:"planned" as const,connected:false,authorized:false,verified:false,
  requiresUserAuthorization:s.requiresUserAuthorization,
  automaticWrites:false
 }));
 return {total:services.length,readyForActivation:0,connected:0,services,
  note:"Cadastro e planejamento apenas. Conexões e autenticações pendentes."};
}
