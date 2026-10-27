import "server-only";
import {
  recordOperationalSuccess,
  recordOperationalFailure,
} from "./operational/server";
import { jarvisOperationalContext } from "./jarvis-operational-context";
import { lookupJarvisMemory } from "./jarvis-memory";
import {
  buildAbacusPlan,
  AbacusError,
  type AbacusInput,
  type AbacusResult,
  type AbacusChunk,
} from "./abacus/protocol";
import { runAbacus } from "./abacus/transport";
import { abacusUsage, tokenLimit } from "./abacus/usage";
export type AbacusReply = AbacusResult;
export async function* streamAbacus(
  message: string,
  signal?: AbortSignal,
  input: AbacusInput = {},
  stream = true,
): AsyncGenerator<AbacusChunk> {
  const key = process.env.ABACUS_API_KEY;
  if (!key) throw new AbacusError("ABACUS_NOT_CONFIGURED", 503);
  if (!message.trim() || message.length > 1500)
    throw new AbacusError("ABACUS_INVALID_RESPONSE", 400);
  const contextQuery = [
    message,
    ...(input.history || [])
      .filter((turn) => turn.role === "user")
      .slice(-2)
      .map((turn) => turn.content),
  ]
    .join(" ")
    .slice(0, 2400);
  const plan = buildAbacusPlan(
    message,
    input,
    lookupJarvisMemory(contextQuery, 2),
    await jarvisOperationalContext(message, signal),
  );
  const reservation = plan.messages.reduce(
    (n, x) => n + new TextEncoder().encode(x.content).length + 12,
    plan.max_tokens + 64,
  );
  const ticket = abacusUsage.begin(reservation, tokenLimit(process.env));
  let completed = false,
    usage: AbacusResult["usage"] = null,
    model = plan.model;
  try {
    for await (const chunk of runAbacus(plan, { key, signal, stream })) {
      if (chunk.type === "done") {
        completed = true;
        recordOperationalSuccess("abacus", ["conversation"]);
        usage = chunk.reply.usage;
        model = chunk.reply.model;
      }
      yield chunk;
    }
  } catch (error) {
    if (
      !signal?.aborted &&
      error instanceof AbacusError &&
      [
        "ABACUS_AUTH",
        "ABACUS_TIMEOUT",
        "ABACUS_UNAVAILABLE",
        "ABACUS_RATE_LIMIT",
      ].includes(error.code)
    )
      recordOperationalFailure("abacus");
    throw error;
  } finally {
    abacusUsage.finish(
      ticket,
      usage,
      model,
      completed ? "completed" : signal?.aborted ? "cancelled" : "failed",
    );
  }
}
export async function askAbacus(
  message: string,
  signal?: AbortSignal,
  input: AbacusInput = {},
): Promise<AbacusReply> {
  for await (const chunk of streamAbacus(message, signal, input, false)) {
    if (chunk.type === "done") return chunk.reply;
  }
  throw new AbacusError("ABACUS_INVALID_RESPONSE", 502);
}
