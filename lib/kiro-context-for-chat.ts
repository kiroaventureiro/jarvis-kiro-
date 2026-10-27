import "server-only";
// Curated snapshot from config/kiro-project-registry.json; review when registry changes.
const registry={"projects":[{"name":"Universo Kiro / Guardiões da Origem","topics":["personagens","fragmentos","episódios","continuidade"],"characters":["Kiro","Luna","Zeca","T-8","Amaris","Zara","Umbra","Vertex","Neon V"]},{"name":"Código Zero","topics":["personagens","histórias","jogo"],"characters":["Leo","Maya","Dan","Nina","Bia","Rafa","Lara","Bolt"]},{"name":"Pai Filho Pai","topics":["cotidiano","animação","continuidade"],"characters":["Pai 1","Pai 2","Filho","Bombom","Benjamim"]},{"name":"KIRO TV","topics":["programação","OBS","automações","programas"],"characters":["Danty","Cocão","T-8"]},{"name":"Kiro Editor","topics":["timeline","vídeo","interface","performance"],"characters":[]},{"name":"Kiro Gestão","topics":["metas","métricas","projetos"],"characters":[]},{"name":"Histórias do Controle","topics":["gameplay","shorts","vídeos"],"characters":[]},{"name":"Umbra Eclipse","topics":["reflexões","shorts"],"characters":["Umbra"]}]} as const;
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
