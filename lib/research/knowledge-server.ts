import "server-only";
import { KnowledgeResearch, knowledgeReply } from "./knowledge";
export const knowledgeResearch = new KnowledgeResearch();
export async function answerKnowledge(message: string, signal?: AbortSignal) {
  try {
    const data = await knowledgeResearch.search(message, signal);
    return data ? knowledgeReply(data) : null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
