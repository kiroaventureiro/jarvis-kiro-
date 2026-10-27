import "server-only";
import { collectEconomy, economyIntent, economyReply } from "./economy";
let cached: { expires: number; reply: ReturnType<typeof economyReply> } | null =
  null;
let pending: Promise<ReturnType<typeof economyReply>> | null = null;
export async function answerResearch(message: string, signal?: AbortSignal) {
  if (!economyIntent(message)) return null;
  if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  if (cached && cached.expires > Date.now()) return cached.reply;
  if (!pending)
    pending = collectEconomy()
      .then((data) => {
        const reply = economyReply(data);
        cached = {
          reply,
          expires:
            Date.now() +
            (data.every((s) => s.status === "ok")
              ? 300000
              : data.some((s) => s.status === "ok")
                ? 60000
                : 15000),
        };
        return reply;
      })
      .finally(() => {
        pending = null;
      });
  const result = await pending;
  if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
  return result;
}
