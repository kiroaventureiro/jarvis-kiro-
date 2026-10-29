import { abacusVoiceEvidence } from "./voice-evidence";
import "server-only";
import {
  ABACUS_SURFACES,
  AbacusDiscovery,
  normalizeObservation,
  hubQuestion,
  type AccountObservation,
} from "./hub";
import {
  MEDIA_MODELS,
  mediaIntent,
  runMedia,
  type MediaKind,
  validateMediaRequest,
} from "./media";
import { connectorStore } from "../connectors/server";
import { costPermission, providerCallBudget } from "../voice/cost-policy";
import { abacusUsage, tokenLimit } from "./usage";
import { mediaHref } from "../holo/validation";
import type { HoloScene } from "../holo/types";
export const abacusDiscovery = new AbacusDiscovery();
export async function accountObservation(): Promise<AccountObservation | null> {
  if (!connectorStore.configured()) return null;
  try {
    return (await connectorStore.read()).abacusObservation || null;
  } catch {
    return null;
  }
}
export async function saveObservation(value: unknown) {
  const observation = normalizeObservation(value);
  await connectorStore.update((state) => {
    state.abacusObservation = observation;
    state.audit.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      operation: "abacus.account_observation",
      outcome: "saved",
    });
  });
  return observation;
}
export async function abacusHub(verify = false, signal?: AbortSignal) {
  const observation = await accountObservation();
  let discovery: Awaited<ReturnType<AbacusDiscovery["inspect"]>> | null = null,
    state = "not_checked";
  if (verify) {
    if (!process.env.ABACUS_API_KEY) state = "not_configured";
    else
      try {
        discovery = await abacusDiscovery.inspect(
          process.env.ABACUS_API_KEY,
          signal,
        );
        state = "verified";
      } catch {
        if (signal?.aborted) throw signal.reason;
        state = "unavailable";
      }
  }
  const permission = costPermission("abacus", process.env);
  return {
    surfaces: ABACUS_SURFACES,
    observation,
    observationStale:
      !!observation &&
      Date.now() - Date.parse(observation.observedAt) > 86400000,
    accountSource: observation ? "owner_observation" : "not_imported",
    state,
    discovery,
    media: {
      implemented: true,
      models: MEDIA_MODELS,
      paidCallsAllowed: permission.allowed,
      callsPerHour: permission.callsPerHour,
      generationTested: false,
    },
    note: "Catálogo valida acesso de leitura; não prova geração nem transfere conectores do ChatLLM. Saldo importado é uma observação datada, não medição em tempo real.",
  };
}
export async function answerAbacusHub(message: string, signal?: AbortSignal) {
  if (!hubQuestion(message)) return null;
  const h = await abacusHub(true, signal),
    o = h.observation;
  const text =
    "A estrutura da Abacus inclui conversa e programação, modelos, ferramentas da organização, criação e análise de imagens, áudio, pesquisa web, Studio de vídeo, agentes, Apps, conectores, MCP e Brain. " +
    (h.discovery
      ? "O catálogo autenticado foi consultado em " +
        new Date(h.discovery.checkedAt).toLocaleString("pt-BR") +
        ": " +
        h.discovery.models.length +
        " modelos; " +
        (h.discovery.toolsState === "verified"
          ? h.discovery.tools.length + " ferramentas publicadas para API."
          : "a lista de ferramentas não pôde ser verificada.")
      : "Não foi possível confirmar agora o catálogo autenticado deste ambiente.") +
    " " +
    (o
      ? "Na observação importada em " +
        new Date(o.observedAt).toLocaleString("pt-BR") +
        ", seu plano era " +
        o.plan +
        " e o saldo observado era " +
        o.remainingCredits +
        " créditos. Isso não é saldo em tempo real. Conectores observados: " +
        (o.connectedServices.join(", ") || "nenhum") +
        ". Tarefas observadas: " +
        (o.activeTasks || []).join(", ") +
        ". Agentes pessoais observados: " +
        (o.personalAgents || []).join(", ") +
        ". "
      : "Os detalhes privados da conta ainda não foram importados para este ambiente. ") +
    "O JK possui adaptadores para imagem, áudio e análise visual, sujeitos à autorização e ao limite já configurados. Vídeo, agentes e conectores da interface Abacus não são automaticamente executáveis por esta API. As ferramentas descobertas não são executadas nesta consulta.";
  return {
    text,
    model: "jk-abacus-hub",
    abacus: abacusVoiceEvidence(h),
    usage: null,
    provider: "local_operational" as const,
    visual: {
      version: 1,
      id: "abacus-" + crypto.randomUUID(),
      title: "Estrutura Abacus",
      mode: "technical",
      createdAt: new Date().toISOString(),
      source: {
        kind: "operational",
        label: "Abacus · catálogo autenticado e observações datadas",
      },
      modules: [0, 6].map((offset) => ({
        id: "capabilities-" + offset,
        kind: "report" as const,
        title: offset ? "Produto e serviços" : "Recursos da API",
        summary: h.note,
        items: h.surfaces.slice(offset, offset + 6).map((s) => ({
          label: s.name,
          detail: s.implemented
            ? "Integração implementada · " + s.access
            : "Disponível no produto; execução pelo JK não confirmada",
        })),
      })),
    } as HoloScene,
  };
}
export async function executeMedia(input: unknown, signal?: AbortSignal, maxOutputTokens = 350) {
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 350 || maxOutputTokens > 1500) throw Error("INVALID_OUTPUT_LIMIT");
  const request = validateMediaRequest(input),
    permission = costPermission("abacus", process.env);
  if (!process.env.ABACUS_API_KEY) throw Error("ABACUS_NOT_CONFIGURED");
  if (!permission.allowed) throw Error("MEDIA_BUDGET_REQUIRED");
  const catalog = await abacusDiscovery.inspect(
    process.env.ABACUS_API_KEY,
    signal,
  );
  if (!catalog.models.some((m) => m.id === request.model))
    throw Error("MODEL_NOT_IN_ACCOUNT_CATALOG");
  const ticket = abacusUsage.begin(
    request.prompt.length + maxOutputTokens + (request.image ? 40000 : 3000),
    tokenLimit(process.env),
  );
  if (!providerCallBudget.admit("abacus", permission).allowed) {
    abacusUsage.finish(
      ticket,
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 },
      request.model,
      "cancelled",
    );
    throw Error("ABACUS_BUDGET");
  }
  try {
    const output = await runMedia(request, process.env.ABACUS_API_KEY, signal, fetch, maxOutputTokens);
    abacusUsage.finish(ticket, output.usage, output.model, "completed");
    let asset: string | undefined, inlineAsset: string | undefined;
    if (output.audio) inlineAsset = "data:audio/mpeg;base64," + output.audio;
    if (output.image) {
      const data =
        /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          output.image,
        );
      if (data) inlineAsset = output.image;
      else asset = mediaHref(output.image);
      if (!asset && !inlineAsset) throw Error("IMAGE_LINK_UNSUPPORTED");
    }
    const text =
      output.text ||
      (request.kind === "image"
        ? "Criei uma imagem para o seu pedido."
        : "Criei o áudio solicitado.");
    const generatedImageId =
      request.kind === "image" && inlineAsset ? crypto.randomUUID() : undefined;
    const visual: HoloScene | undefined =
      request.kind === "image" && (asset || generatedImageId)
        ? {
            version: 1,
            id: "generation-" + crypto.randomUUID(),
            title: "Imagem criada",
            mode: "creative",
            createdAt: new Date().toISOString(),
            source: {
              kind: "assistant",
              label: "Imagem sintética · Abacus " + output.model,
            },
            narration: text,
            modules: [
              {
                id: "generated-image",
                kind: "media",
                title: request.prompt.slice(0, 90),
                items: [
                  {
                    id: "generated",
                    label: "Imagem gerada por IA",
                    type: "image",
                    ...(asset ? { url: asset } : { localId: generatedImageId }),
                    caption:
                      "Criação sintética; não é fotografia ou evidência de um fato.",
                    mediaNature: "illustration",
                  },
                ],
              },
            ],
          }
        : undefined;
    return {
      text,
      model: output.model,
      usage: output.usage,
      provider: "abacus" as const,
      ...(asset ? { asset } : {}),
      ...(inlineAsset ? { inlineAsset } : {}),
      ...(generatedImageId ? { generatedImageId } : {}),
      kind: request.kind,
      ...(visual ? { visual } : {}),
    };
  } catch (error) {
    abacusUsage.finish(
      ticket,
      null,
      request.model,
      signal?.aborted ? "cancelled" : "failed",
    );
    throw error;
  }
}
export async function answerMediaRequest(
  message: string,
  signal?: AbortSignal,
) {
  const kind = mediaIntent(message);
  if (!kind) return null;
  // Only explicit creation requests may consume the existing authorized generation budget.
  if (
    kind === "image" &&
    process.env.ABACUS_API_KEY &&
    costPermission("abacus", process.env).allowed
  ) {
    try {
      const catalog = await abacusDiscovery.inspect(
        process.env.ABACUS_API_KEY,
        signal,
      );
      const model = MEDIA_MODELS.image.find((id) =>
        catalog.models.some((m) => m.id === id),
      );
      if (model)
        return await executeMedia({ kind, prompt: message, model }, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        text: "Não foi possível concluir a criação da imagem. Não houve nova tentativa automática. Consulte o estado e o orçamento da Abacus na Central de Conexões.",
        model: "jk-media-unavailable",
        usage: null,
        provider: "local_operational" as const,
      };
    }
  }

  return {
    text:
      "Preparei o caminho de " +
      (kind === "image" ? "criação de imagem" : "criação de áudio") +
      " pela Abacus. Abra a Central de Conexões para escolher um modelo disponível e executar esse pedido dentro do orçamento autorizado. Nenhuma geração foi cobrada nesta resposta.",
    model: "jk-media-ready",
    usage: null,
    provider: "local_operational" as const,
    visual: {
      version: 1,
      id: "media-request-" + crypto.randomUUID(),
      title: "Criação pela Abacus",
      mode: "creative",
      createdAt: new Date().toISOString(),
      source: { kind: "operational", label: "Abacus · criação disponível" },
      modules: [
        {
          id: "create",
          kind: "report",
          title: kind === "image" ? "Criar imagem" : "Criar áudio",
          summary: message,
          items: [
            {
              label: "Próxima ação",
              detail:
                "Selecione um modelo e execute no laboratório Abacus da Central de Conexões.",
            },
          ],
          href: "/conexoes",
        },
      ],
    } as HoloScene,
  };
}
