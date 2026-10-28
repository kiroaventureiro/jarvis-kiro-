// Loopback-only test fixture. Never imported by application source.
require("./abacus-hub-runtime.cjs");
const previousDesignFetch = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (
    url.hostname === "api.abacus.ai" &&
    url.pathname === "/api/v0/listProjects"
  )
    return Response.json({
      success: true,
      result: [
        {
          projectId: "fixture-project",
          projectName: "Projeto da plataforma verificado",
          useCase: "CHAT_LLM",
        },
      ],
    });
  if (
    url.hostname === "api.abacus.ai" &&
    url.pathname === "/api/v0/listDeployments"
  ) {
    if (url.searchParams.get("projectId") !== "fixture-project")
      throw Error("Project scope required");
    return Response.json({
      success: true,
      result: Array.from({ length: 8 }, (_, i) => ({
        deploymentId: "fixture-dep-" + i,
        deploymentName: "Deployment verificado " + (i + 1),
      })),
    });
  }
  if (
    url.hostname === "api.abacus.ai" &&
    url.pathname === "/api/v0/getDeploymentConversation"
  )
    return Response.json({
      success: true,
      result: {
        deploymentConversationId: url.searchParams.get(
          "deploymentConversationId",
        ),
        conversationType: "COMPLEX_AGENT",
      },
    });
  if (
    url.hostname === "routellm.abacus.ai" &&
    url.pathname === "/v1/chat/completions"
  ) {
    const body = JSON.parse(options.body || "{}");
    if (
      body.messages?.some(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some(
            (p) => p.type === "text" && p.text.includes("APENAS JSON compacto"),
          ),
      )
    )
      return Response.json({
        model: "fixture-route-llm",
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                title: "Referência Kiro",
                background: "#07121f",
                foreground: "#e8f4ff",
                accent: "#38d9f5",
                radius: 18,
                font: "sans-serif",
                sections: [
                  {
                    title: "Apresentação",
                    text: "Conteúdo observado no cenário simulado.",
                    kind: "hero",
                  },
                  {
                    title: "Projetos",
                    text: "Cartões da referência.",
                    kind: "cards",
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 40, completion_tokens: 100, total_tokens: 140 },
      });
  }
  return previousDesignFetch(input, options);
};
