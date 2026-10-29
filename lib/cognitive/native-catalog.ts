import { CapabilityRegistry } from "./registry";
import type { Observation, Capability } from "./types";
const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const arr = (x: unknown) => (Array.isArray(x) ? x.slice(0, 100) : []);
const out = (
  summary: string,
  limits: string[],
  facts: Observation["facts"] = {},
  signals: string[] = [],
): Observation => ({ summary, limits, facts, signals });
const invalid = () =>
  out("O formato retornado não permite confirmar o resultado.", [
    "Resposta não interpretável; não comprova funcionamento.",
  ]);
export function createNativeCatalog() {
  const registry = new CapabilityRegistry();
  const add = (
    provider: string,
    operation: string,
    aliases: string[],
    inspect: Capability["inspect"],
    purpose: Capability["purpose"] = "overview",
    validate: Capability["validate"] = (a) => Object.keys(a).length === 0,
  ) =>
    registry.register({
      id: provider + ":" + operation,
      provider,
      operation,
      aliases,
      purpose,
      effect: "read",
      permission: "read",
      cost: "no_model_call",
      timeoutMs: 12000,
      maxCalls: 5,
      validate,
      inspect,
    });
  add(
    "github",
    "repo",
    ["git hub", "repositorio", "repositorios", "codigo"],
    (d) => {
      const r = obj(d);
      return typeof r.defaultBranch === "string"
        ? out(
            "O repositório está acessível.",
            [
              "Acessibilidade não confirma qualidade do código, execução dos testes ou segurança.",
            ],
            { accessible: true },
          )
        : invalid();
    },
  );
  add(
    "github",
    "commits",
    [],
    (d) => {
      if (!Array.isArray(d)) return invalid();
      const a = arr(d),
        sha = obj(a[0]).sha;
      return out(
        a.length + " commits retornados nesta amostra.",
        ["A contagem é limitada; não foi executado código."],
        {
          count: a.length,
          ...(typeof sha === "string" && /^[a-f0-9]{40}$/i.test(sha)
            ? { latestSha: sha }
            : {}),
        },
      );
    },
    "inspect",
  );
  add(
    "github",
    "checks",
    [],
    (d) => {
      const r = obj(d);
      if (typeof r.failed !== "boolean" || typeof r.passed !== "boolean")
        return invalid();
      return out(
        r.failed
          ? "Os checks consultados registram falha."
          : r.passed
            ? "Os checks consultados foram aprovados."
            : "Os checks não confirmam aprovação até o momento.",
        [
          "O resultado vale para o commit consultado; não é teste ao vivo do site.",
        ],
        { failed: r.failed, passed: r.passed },
        r.failed ? ["Falha registrada no CI consultado."] : [],
      );
    },
    "inspect",
    (a) =>
      Object.keys(a).length === 1 &&
      typeof a.sha === "string" &&
      /^[a-f0-9]{40}$/i.test(a.sha),
  );
  add(
    "github",
    "file",
    [],
    (d) => {
      const r = obj(d);
      if (typeof r.content !== "string") return invalid();
      try {
        const p = obj(JSON.parse(r.content));
        const s = obj(p.scripts),
          deps = obj(p.dependencies);
        return out(
          "O manifesto do projeto foi lido; " +
            (typeof s.test === "string"
              ? "há um comando de teste declarado."
              : "não foi identificado um comando de teste."),
          [
            "Comandos declarados não foram executados. Dependências não foram auditadas.",
          ],
          {
            testDeclared: typeof s.test === "string",
            buildDeclared: typeof s.build === "string",
            dependencies: Object.keys(deps).length,
          },
        );
      } catch {
        return out(
          "O arquivo foi recebido, mas não é um manifesto JSON válido.",
          ["Conteúdo externo não foi executado nem utilizado como instrução."],
        );
      }
    },
    "inspect",
    (a) =>
      a.path === "package.json" &&
      Object.keys(a).every((k) => ["path", "ref"].includes(k)),
  );
  add(
    "vercel",
    "deployments",
    ["versel", "deployments", "deploy", "publicacoes", "implantacoes"],
    (d) => {
      if (!Array.isArray(d)) return invalid();
      const a = arr(d),
        ready = a.filter((x) => obj(x).state === "READY").length,
        errors = a.filter((x) => obj(x).state === "ERROR").length;
      return out(
        a.length +
          " deployments nesta amostra: " +
          ready +
          " prontos e " +
          errors +
          " com erro.",
        [
          "Pronto é um estado do deployment; não confirma disponibilidade ou correção do aplicativo. A amostra pode incluir versões antigas.",
        ],
        { count: a.length, ready, errors },
        errors
          ? [
              "Há deployment com erro na amostra; examine o build correspondente antes de atribuir causa.",
            ]
          : [],
      );
    },
  );
  add(
    "supabase",
    "schemas",
    ["supa base", "banco de dados", "tabelas", "schemas"],
    (d) => {
      if (
        !Array.isArray(d) ||
        d.some((x) => typeof obj(x).table_schema !== "string")
      )
        return invalid();
      const count = arr(d).filter(
        (x) => obj(x).table_schema === "public",
      ).length;
      return out(
        count + " tabelas públicas retornadas na consulta limitada.",
        [
          "Dados das tabelas, RLS e memória do JK não foram testados por esta leitura.",
        ],
        { publicTables: count },
      );
    },
  );
  add(
    "supabase",
    "diagnostics",
    [],
    (d) => {
      const r = obj(d),
        a = Array.isArray(d)
          ? arr(d)
          : Array.isArray(r.lints)
            ? arr(r.lints)
            : null;
      return a
        ? out(
            a.length +
              " apontamentos retornados pelo diagnóstico de segurança.",
            [
              "Apontamentos exigem análise individual; não comprovam exploração de vulnerabilidade.",
            ],
            { findings: a.length },
            a.length
              ? ["O provedor retornou apontamentos de segurança para revisão."]
              : [],
          )
        : invalid();
    },
    "inspect",
  );
  return registry;
}
