import "server-only";
import { councilQuestion, runCouncil } from "./council";
import { askAbacus } from "../abacus-routellm";
import { costPermission, providerCallBudget } from "../voice/cost-policy";
export async function answerCouncilRequest(
  message: string,
  signal?: AbortSignal,
  allowExecution = true,
) {
  const question = councilQuestion(message);
  if (question === null) return null;
  if (!allowExecution)
    return {
      text: "O Conselho ainda não executa deliberações pela ferramenta de voz. Use Conselho: seguido da pergunta na conversa por teclado. O servidor também precisa autorizar as até cinco chamadas adicionais; nenhuma foi iniciada aqui.",
      model: "jk-council",
      provider: "local_operational" as const,
      usage: null,
    };
  const permission = costPermission("abacus", process.env);
  const council = await runCouncil(question, {
    enabled:
      allowExecution &&
      process.env.JARVIS_COUNCIL_ENABLED === "true" &&
      !!process.env.ABACUS_API_KEY &&
      permission.allowed,
    signal,
    admit: () => providerCallBudget.admit("abacus", permission).allowed,
    ask: (prompt, abort) => askAbacus(prompt, abort, { task: "chat" }),
  });
  return {
    text: council.text,
    model: "jk-council",
    provider: "local_operational" as const,
    usage: null,
    council,
  };
}
