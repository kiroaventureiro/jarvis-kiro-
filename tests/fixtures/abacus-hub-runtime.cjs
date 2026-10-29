// Explicit loopback fixture: never imported by application code.
require("./visual-freedom-runtime.cjs");
Object.assign(process.env, {
  ABACUS_API_KEY: "fixture-abacus-not-a-real-key",
  JARVIS_ABACUS_PAID_ALLOWED: "true",
  JARVIS_ABACUS_MAX_CALLS_PER_HOUR: "12",
  JARVIS_ABACUS_MAX_TOKENS_PER_HOUR: "200000",
  JARVIS_COGNITIVE_SEMANTIC_ENABLED: "false",
});
const prior = globalThis.fetch;
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
globalThis.fetch = async (input, options = {}) => {
  const u = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (u.hostname === "routellm.abacus.ai" && u.pathname === "/v1/models") {
    if ((options.method || "GET") !== "GET")
      throw Error("Unexpected model operation");
    return Response.json({
      data: [
        { id: "route-llm" },
        { id: "flux2", pricing: { image: "0.01" } },
        { id: "gpt-audio-mini" },
        { id: "gemini-2.5-flash" },
      ],
    });
  }
  if (
    u.hostname === "api.abacus.ai" &&
    u.pathname === "/api/v0/listRouteLLMTools"
  )
    return Response.json({
      tools: [
        {
          name: "read_inventory",
          description: "Ferramenta simulada de leitura",
          supported: true,
          requires_connectors: [],
        },
        {
          name: "write_external",
          description: "Não executar",
          supported: true,
          requires_connectors: ["gmail"],
        },
      ],
    });
  if (
    u.hostname === "routellm.abacus.ai" &&
    u.pathname === "/v1/chat/completions"
  ) {
    const b = JSON.parse(options.body || "{}");
    if (b.abacus_tools || b.tools)
      throw Error("Unexpected external tool execution");
    if (b.modalities?.includes("image"))
      return Response.json({
        model: b.model,
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Imagem de teste, geração simulada.",
              images: [{ image_url: { url: "data:image/png;base64," + png } }],
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      });
    if (b.modalities?.includes("audio"))
      return Response.json({
        model: b.model,
        choices: [
          {
            finish_reason: "stop",
            message: { content: "Áudio simulado.", audio: { data: "SUQz" } },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4 },
      });
    return Response.json({
      model: b.model,
      choices: [
        {
          finish_reason: "stop",
          message: { content: "Análise simulada da imagem recebida." },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 4 },
    });
  }
  if (u.hostname === "api.crossref.org" && u.pathname === "/works")
    return Response.json({
      message: {
        items: [
          {
            DOI: "10.1234/fixture",
            title: ["Semicondutores: referência simulada"],
            author: [{ given: "Autor", family: "Teste" }],
            published: { "date-parts": [[2025]] },
          },
        ],
      },
    });
  if (u.hostname === "openlibrary.org" && u.pathname === "/search.json")
    return Response.json({
      docs: [
        {
          key: "/works/OL123W",
          title: "Cinema: registro simulado",
          author_name: ["Autor Teste"],
          first_publish_year: 2000,
        },
      ],
    });
  return prior(input, options);
};
