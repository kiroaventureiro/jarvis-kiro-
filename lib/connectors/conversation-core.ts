import { requestedProject, selectProjectResources } from "./project-selection";
import {
  contextualReadMessage,
  isReadFollowup,
  selfDiagnosticIntent,
  type ReadTurn,
} from "./read-context";
import type { ConnectorService } from "./service";
import type { StateStore } from "./types";
import { type Provider } from "./types";
import type { HoloScene } from "../holo/types";

/** Extend this registry when a real, authorized native adapter is added. */
const READ_PROVIDERS: Record<Provider, { aliases: string[]; summary: string }> =
  {
    github: {
      aliases: [
        "github",
        "git hub",
        "repositorio",
        "repositorios",
        "codigo",
        "commits",
        "commit",
        "branch",
        "branches",
      ],
      summary: "Repositórios, código e commits",
    },
    vercel: {
      aliases: [
        "vercel",
        "versel",
        "deploy",
        "deployments",
        "implantacoes",
        "publicacoes",
        "build",
      ],
      summary: "Projetos e deployments",
    },
    supabase: {
      aliases: ["supabase", "supa base", "banco de dados", "tabelas"],
      summary: "Schemas e diagnósticos",
    },
  };
function normalize(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
const readIntent =
  /\b(consult|verifi[cq]|analis|diagnosti[cq]|listar|liste|mostr|entre|entrar|acesse|acessar|abra|abrir|pesquis|status|situacao|meus projetos|minhas conexoes)\w*/;
/** Convert provider responses into bounded, non-sensitive observations. Never send raw rows to speech. */
function observation(provider: Provider, data: unknown): string {
  const items = Array.isArray(data) ? data : null;
  if (provider === "github") {
    if (data && typeof data === "object" && !items) {
      const r = data as Record<string, unknown>;
      const branch =
        typeof r.defaultBranch === "string" ? r.defaultBranch : null;
      const description =
        typeof r.description === "string" ? r.description.slice(0, 110) : null;
      return (
        "Repositório acessível" +
        (branch ? "; branch principal: " + branch : "") +
        (description ? "; descrição: " + description : "") +
        ". Não foram examinados arquivos nem testes."
      );
    }
    return "Consulta ao GitHub concluída; conteúdo exige inspeção específica.";
  }
  if (provider === "vercel") {
    if (!items)
      return "Resposta da Vercel recebida; formato não reconhecido para análise.";
    const ready = items.filter(
      (x) =>
        x &&
        typeof x === "object" &&
        (x as Record<string, unknown>).state === "READY",
    ).length;
    const errors = items.filter(
      (x) =>
        x &&
        typeof x === "object" &&
        (x as Record<string, unknown>).state === "ERROR",
    ).length;
    return (
      items.length +
      " deployments listados; " +
      ready +
      " prontos e " +
      errors +
      " com erro nesta amostra. Isto não mede o funcionamento do site em tempo real."
    );
  }
  if (!items)
    return "Consulta ao Supabase concluída; resposta não permite contabilizar tabelas com segurança.";
  const publicTables = items.filter(
    (x) =>
      x &&
      typeof x === "object" &&
      (x as Record<string, unknown>).table_schema === "public",
  );
  return (
    publicTables.length +
    " tabelas públicas listadas na consulta limitada; dados e permissões de cada tabela não foram analisados."
  );
}
function displayName(name: string) {
  return name.split("/").at(-1)!.replace(/[-_]/g, " ");
}
export async function conversationalConnectorRead(
  message: string,
  dependencies: {
    connectors: Pick<ConnectorService, "readAuthorized">;
    connectorStore: Pick<StateStore, "configured" | "read">;
  },
  history: ReadTurn[] = [],
  signal?: AbortSignal,
) {
  const { connectors, connectorStore } = dependencies;
  if (selfDiagnosticIntent(message))
    message = "Diagnostique Jarvis Kiro no GitHub, na Vercel e no Supabase";
  let n = normalize(message);
  const followup = isReadFollowup(message) && history.length > 0;
  if (!readIntent.test(n) && !followup) return null;
  const mentioned = (Object.keys(READ_PROVIDERS) as Provider[]).filter((p) =>
    READ_PROVIDERS[p].aliases.some((alias) => n.includes(alias)),
  );
  const detailedGitHub =
    /\b(commits?|branches|issues|pulls|pull requests|historico|alteracoes recentes)\b/.test(
      n,
    );
  const all =
    /\b(todos|todas|tudo|conexoes|integracoes|plataformas)\b/.test(n) ||
    /meus projetos|minhas conexoes/.test(n);
  let providers = mentioned.length
    ? mentioned
    : all || followup
      ? (Object.keys(READ_PROVIDERS) as Provider[])
      : [];
  if (!providers.length) return null;
  if (!connectorStore.configured())
    return {
      text: "O cofre dos conectores não está configurado neste ambiente.",
      model: "jk-tools",
      provider: "local_operational" as const,
      usage: null,
    };
  try {
    const state = await connectorStore.read();
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    const contextual = contextualReadMessage(
      message,
      Object.values(state.connections).flatMap((c) => c?.resources || []),
      history,
    );
    n = normalize(contextual);
    if (followup) {
      const services = (Object.keys(READ_PROVIDERS) as Provider[]).filter((p) =>
        READ_PROVIDERS[p].aliases.some((alias) => n.includes(alias)),
      );
      if (services.length) providers = services;
      else if (!all) return null;
    }
    const results: string[] = [];
    let successful = 0;
    let failed = 0;
    const verifiedNames: string[] = [];
    const failedNames: string[] = [];
    const findings: string[] = [];
    const panels: Array<{ label: string; detail: string }> = [];
    const selected = requestedProject(
      contextual,
      providers.flatMap((p) => state.connections[p]?.resources || []),
    );
    // Provider-only commands mean discover authorized resources, not a named project.
    const selection = selected;
    if (selection.kind === "unresolved")
      return {
        text:
          selection.reason + " Nenhuma consulta ou alteração foi executada.",
        model: "jk-tools",
        provider: "local_operational" as const,
        usage: null,
      };
    for (const provider of providers) {
      const c = state.connections[provider];
      if (!c || c.status !== "connected") {
        results.push(provider + ": sem conexão ativa.");
        panels.push({
          label: provider.toUpperCase(),
          detail: "Sem conexão ativa",
        });
        continue;
      }
      if (!c.grants.includes("read")) {
        results.push(provider + ": leitura não autorizada.");
        panels.push({
          label: provider.toUpperCase(),
          detail: "Leitura não autorizada",
        });
        continue;
      }
      if (!c.resources.length) {
        results.push(
          provider + ": conectado, mas nenhum projeto foi autorizado no JK.",
        );
        panels.push({
          label: provider.toUpperCase(),
          detail: "Nenhum projeto autorizado",
        });
        continue;
      }
      results.push(
        provider.toUpperCase() +
          ": " +
          c.resources.length +
          " projeto(s) autorizado(s).",
      );
      const targets = selectProjectResources(selection, c.resources).slice(
        0,
        5,
      );
      if (!targets.length) {
        results.push(
          provider + ": projeto solicitado não está no escopo deste provedor.",
        );
        panels.push({
          label: provider.toUpperCase(),
          detail:
            "Projeto solicitado não está no escopo deste provedor; nenhum outro projeto foi consultado.",
        });
        continue;
      }
      for (const resource of targets) {
        if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
        const op =
          provider === "github"
            ? "repo"
            : provider === "vercel"
              ? "deployments"
              : "schemas";
        try {
          const checked = await connectors.readAuthorized(
            provider,
            resource.id,
            op,
            {},
            signal,
          );
          successful++;
          verifiedNames.push(resource.name);
          let finding = observation(provider, checked.data);
          if (provider === "github" && detailedGitHub) {
            const detailOperation = /\b(branch|branches)\b/.test(n)
              ? "branches"
              : /\b(issues|problemas abertos)\b/.test(n)
                ? "issues"
                : /\b(pulls|pull requests)\b/.test(n)
                  ? "pulls"
                  : "commits";
            try {
              const detail = await connectors.readAuthorized(
                provider,
                resource.id,
                detailOperation,
                {},
                signal,
              );
              const rows = Array.isArray(detail.data)
                ? detail.data.slice(0, 5)
                : [];
              const names = rows.flatMap((item) => {
                if (!item || typeof item !== "object") return [];
                const entry = item as Record<string, unknown>;
                const label =
                  typeof entry.message === "string"
                    ? entry.message
                    : typeof entry.title === "string"
                      ? entry.title
                      : typeof entry.name === "string"
                        ? entry.name
                        : null;
                return label
                  ? [label.replace(/[\u0000-\u001f]/g, " ").slice(0, 100)]
                  : [];
              });
              finding +=
                " " +
                detailOperation +
                ": " +
                (names.join("; ") || rows.length + " registros sem título");
            } catch {
              finding +=
                " A consulta adicional de " +
                detailOperation +
                " não foi concluída.";
            }
          }
          findings.push(
            provider.toUpperCase() +
              " · " +
              displayName(resource.name) +
              ": " +
              finding,
          );
          results.push(
            "- " +
              resource.name +
              ": consulta de " +
              (provider === "github"
                ? "repositório"
                : provider === "vercel"
                  ? "publicações"
                  : "estrutura do banco") +
              " concluída.",
          );
          panels.push({
            label: provider.toUpperCase() + " · " + resource.name,
            detail: finding,
          });
        } catch {
          if (signal?.aborted)
            throw new DOMException("Cancelado", "AbortError");
          failed++;
          failedNames.push(resource.name);
          results.push(
            "- " +
              resource.name +
              " | não foi possível consultar agora; não afirmar que o projeto foi verificado.",
          );
          panels.push({
            label: provider.toUpperCase() + " · " + resource.name,
            detail: "Consulta indisponível; nenhum resultado confirmado",
          });
        }
      }
      if (c.resources.length > targets.length)
        results.push(
          "Outros " +
            (c.resources.length - targets.length) +
            " projetos autorizados não foram consultados nesta resposta para limitar tempo e volume. Solicite uma consulta específica.",
        );
    }
    const sampleNames = [...new Set(verifiedNames)]
      .slice(0, 4)
      .map((name) => name.split("/").at(-1)!.replace(/[-_]/g, " "));
    const examples = sampleNames.length
      ? " Entre os projetos verificados estão " + sampleNames.join(", ") + "."
      : "";
    const failureNote =
      failed === 1
        ? " Uma consulta não pôde ser concluída"
        : failed > 1
          ? " " + failed + " consultas não puderam ser concluídas"
          : "";
    const failureDetail = failedNames.length
      ? ": " +
        failedNames
          .slice(0, 2)
          .map((name) => name.split("/").at(-1)!.replace(/[-_]/g, " "))
          .join(" e ") +
        "."
      : ".";
    const focused =
      /commits?|branches|issues|pulls|pull requests|historico|alteracoes recentes|detalh|aprofund|resultado|encontr|problema|erro|situacao|diagnosti[cq]|analis/.test(
        n,
      );
    const selectedFindings = focused ? findings.slice(0, 3) : [];
    const text =
      (results.some((x) => x.includes("não está no escopo"))
        ? "O projeto solicitado não está autorizado em um dos provedores; consulte os detalhes no resultado. "
        : "") +
      (selectedFindings.length
        ? selectedFindings.join(" ")
        : successful
          ? "Fiz " +
            successful +
            (successful === 1
              ? " consulta de leitura."
              : " consultas de leitura.") +
            examples
          : results.slice(0, 3).join(" ")) +
      (failed ? failureNote + failureDetail : "");
    const visual: HoloScene = {
      version: 1,
      id: "jk-connected-projects-" + Date.now(),
      title: "Diagnóstico dos sistemas conectados",
      mode: "technical",
      createdAt: new Date().toISOString(),
      source: {
        kind: "connector",
        label: "Consultas reais aos provedores autorizados",
        checkedAt: new Date().toISOString(),
      },
      modules: [
        {
          id: "verified-projects",
          kind: "report",
          title: "Projetos e consultas verificadas",
          summary:
            "Somente leitura. Resultados limitados às operações concluídas nesta solicitação.",
          items: panels.slice(0, 8),
          body: results.join("\n"),
        },
      ],
      narration: text,
    };
    return {
      text,
      visual,
      result: { kind: "connector_read", entries: results },
      model: "jk-tools",
      provider: "local_operational" as const,
      usage: null,
    };
  } catch {
    if (signal?.aborted) throw new DOMException("Cancelado", "AbortError");
    return {
      text: "Não consegui consultar o cofre dos conectores agora. Não posso garantir que as contas estejam desconectadas.",
      model: "jk-tools",
      provider: "local_operational" as const,
      usage: null,
    };
  }
}
