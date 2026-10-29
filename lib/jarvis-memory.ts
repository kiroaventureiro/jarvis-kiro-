import "server-only";
import memory from "../config/operational-memory.json";
export type JarvisMemoryRecord = (typeof memory.records)[number];
/** Minimal curated index, not a database or automatic user-memory system. */
export function lookupJarvisMemory(query:string,limit=5):JarvisMemoryRecord[]{
 const terms=query.toLocaleLowerCase("pt-BR").split(/[^\p{L}\p{N}]+/u).filter(s=>s.length>=3).slice(0,12);
 if(!terms.length) return [];
 return memory.records.map(record=>{
  const haystack=[record.project,record.topic,record.summary,record.decision].join(" ").toLocaleLowerCase("pt-BR");
  return {record,score:terms.reduce((n,term)=>n+(haystack.includes(term)?1:0),0)};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(limit,10))).map(x=>x.record);
}
