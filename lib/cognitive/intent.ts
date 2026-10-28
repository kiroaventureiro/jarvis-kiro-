import type { Depth, Intent } from "./types";
export const normalized = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bgit\s+hub\b/g, "github")
    .replace(/\bversel\b/g, "vercel")
    .replace(/\bsupa\s+base\b/g, "supabase");
export function depthFor(message: string, previous?: Depth): Depth {
  const n = normalized(message);
  return /aprofund|profund|complet|exaustiv/.test(n)
    ? "deep"
    : /detalh|em detalhes/.test(n)
      ? "detailed"
      : /breve|resum|rapido/.test(n)
        ? "brief"
        : previous || "normal";
}
/** Classifies conversational acts independently of resource resolution and execution policy. Unknown language can use a validated semantic proposal, never an executable model action. */
export function understand(
  message: string,
  aliases: Record<string, string[]>,
  previousDepth?: Depth,
): Intent {
  const n = normalized(message);
  const providers = Object.keys(aliases).filter((p) =>
    aliases[p].some((a) =>
      new RegExp(
        "(?:^|[^a-z0-9])" +
          a.replace(/[.*+?^$()|[\]\\]/g, "\\$&") +
          "(?:$|[^a-z0-9])",
      ).test(n),
    ),
  );
  const followUp =
    /^(e\b|agora\b|continue\b|aprofunde\b)|\b(nesse|neste|desse|deste|esse projeto|esse resultado|o anterior|deles|desses|encontrou|encontramos|consultou|verificou|lembra)\b/.test(
      n,
    );
  const refresh =
    /\b(agora|novamente|atualize|atualizar|nova consulta|consulte|verifique|verificar|deployments|publicacoes)\b/.test(
      n,
    );
  const goal: Intent["goal"] =
    /\b(corrija|corrigir|altere|alterar|crie|criar|exclua|excluir|apague|publique|implante|deploy em producao|migre|modifique)\b/.test(
      n,
    )
      ? "modify"
      : /compar|anterior/.test(n)
        ? "compare"
        : /encontr|consultou|verificou|lembra|qual deles|o que houve|que aconteceu|resultado|aprofunde|continue/.test(
              n,
            ) && !refresh
          ? "recall"
          : /diagnos|analis|problema|saude|saudavel|funcionando/.test(n)
            ? "diagnose"
            : /consult|verifi[cq]|mostr|listar|liste|status|situacao/.test(n) ||
                providers.length
              ? "query"
              : "explain";
  return {
    goal,
    providers,
    depth: depthFor(message, previousDepth),
    refresh,
    followUp,
    all: /\b(todos|todas|meus projetos|minhas conexoes)\b/.test(n),
  };
}
