import "server-only";
import registry from "../config/kiro-project-registry.json";
const maxProjects=12;
const trigger=/\b(kiro|produ[cç][oõ]es|projetos|guardi[oõ]es|c[oó]digo zero|pai filho pai|tv|universo|origem)\b/i;
export function kiroChatContext(message:string):string {
 if(!trigger.test(message))return "";
 const projects=registry.projects.slice(0,maxProjects).map(p=>({
  name:p.name.slice(0,90),
  topics:p.topics.slice(0,5).map(t=>t.slice(0,35)),
  characters:p.characters.slice(0,10).map(c=>c.slice(0,35))
 }));
 return " Projetos cadastrados no índice local da KIRO Produções (dados fornecidos anteriormente pelo proprietário; NÃO são conexões nem estados operacionais ao vivo): "+
 JSON.stringify(projects)+
 " Ao ser perguntado quais projetos conhece, cite este índice; diferencie claramente conhecer o contexto de ter contas ou integrações conectadas. Não afirme que nada da KIRO está cadastrado quando o índice fornecer projetos.";
}
