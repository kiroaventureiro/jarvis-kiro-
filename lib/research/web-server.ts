import "server-only";
import { runWebResearch, webResearchPolicy } from "./web";
import { publicResearchQuery } from "../cognitive/request-intent";
import { costPermission, providerCallBudget } from "../voice/cost-policy";
import { abacusUsage, tokenLimit } from "../abacus/usage";
export async function answerWebResearch(message: string, signal?: AbortSignal) {
  const policy = webResearchPolicy(process.env),
    permission = costPermission("abacus", process.env);
  if (
    !policy.enabled ||
    !permission.allowed ||
    !process.env.ABACUS_API_KEY ||
    !publicResearchQuery(message)
  )
    return null;
  if (!providerCallBudget.admit("abacus", permission).allowed)
    return {
      text: "O orçamento de pesquisa disponível para esta janela foi atingido. A pesquisa não foi iniciada.",
      model: "jk-research",
      usage: null,
    };
  let ticket: number | undefined;
  try {
    ticket = abacusUsage.begin(
      message.length + policy.maxOutputTokens + 6000,
      tokenLimit(process.env),
    );
    const reply = await runWebResearch(message, {
      key: process.env.ABACUS_API_KEY,
      policy,
      signal,
    });
    abacusUsage.finish(ticket, reply.usage, reply.model, "completed");
    return reply;
  } catch (error) {
    if (ticket !== undefined)
      abacusUsage.finish(
        ticket,
        null,
        policy.model,
        signal?.aborted ? "cancelled" : "failed",
      );
    if (signal?.aborted) throw error;
    return {
      text: "A pesquisa web não pôde ser concluída agora. Nenhuma fonte ou conclusão foi inventada; a falha ficou limitada a esta tentativa.",
      model: "jk-research",
      usage: null,
    };
  }
}
