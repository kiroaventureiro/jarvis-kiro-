import { normalized } from "./intent";
export type RequestIntent =
  | "geography"
  | "history"
  | "current"
  | "connector"
  | "research"
  | "conversation";
/** Topic-independent intent precedes specialist modules. Place names alone never request maps. */
export function requestIntent(message: string): RequestIntent {
  const n = normalized(message);
  if (
    /\b(github|vercel|supabase|repositorio|deployment|meus projetos|minhas conexoes)\b/.test(
      n,
    )
  )
    return "connector";
  if (/\b(historia|historico|origem historica)\b/.test(n)) return "history";
  if (
    /\b(mapa|mundi|localize|localizar|onde fica|geografia|mostre a localizacao|ruas de|rota para)\b/.test(
      n,
    )
  )
    return "geography";
  if (
    /\b(hoje|atualmente|agora|ultimas noticias|atual|como esta|como estao)\b/.test(
      n,
    )
  )
    return "current";
  if (
    /\b(pesquis|pesquise|investigue|busque|explique|quem foi|quem e|o que e|como funciona|por que|porque|compare|analise|informe|qual|quais|quando|quanto|onde comer)/.test(
      n,
    )
  )
    return "research";
  return "conversation";
}
export function publicResearchQuery(message: string) {
  if (!["research", "history", "current"].includes(requestIntent(message)))
    return null;
  const n = normalized(message);
  if (
    /\b(meu|minha|meus|minhas|nosso|nossa|senha|token|chave|credencial|cliente|paciente|funcionario|cpf|cnpj|endereco)\b/.test(
      n,
    ) ||
    /@|https?:\/\/|\b(?:sk-|ghp_|sb_secret_)|\b\d{8,}\b/i.test(message)
  )
    return null;
  return message
    .trim()
    .replace(
      /^(?:jarvis[, ]+)?(?:por favor[, ]+)?(?:pesquise|investigue|busque|explique|analise|conte|me diga)\s+(?:sobre\s+)?/i,
      "",
    )
    .replace(
      /^(?:como funciona(?:m)?|quem (?:foi|é|e)|o que (?:é|e|são|sao)|como est(?:á|a|ão|ao))\s+/i,
      "",
    )
    .replace(/\b(?:hoje|atualmente)\b[?.!]*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/[?]+$/g, "")
    .trim()
    .slice(0, 240);
}
