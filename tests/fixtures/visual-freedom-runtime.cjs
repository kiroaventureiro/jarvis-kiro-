require("./holo-v3-runtime.cjs");
const original = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  if (
    ["pt.wikipedia.org", "en.wikipedia.org"].includes(url.hostname) &&
    url.pathname === "/w/api.php"
  ) {
    if (options.method && options.method !== "GET")
      throw Error("Read-only reference fixture");
    const brazil = (url.searchParams.get("gsrsearch") || "")
      .toLowerCase()
      .includes("brasil");
    return Response.json({
      query: {
        pages: [
          {
            title: brazil ? "Brasil" : "Semicondutor",
            extract: brazil
              ? "O Brasil é um país com diversidade territorial, social e econômica. Esta referência enciclopédica não é um levantamento das notícias de hoje."
              : "Materiais com condutividade entre isolantes e condutores são utilizados em transistores e circuitos eletrônicos. Este texto é uma resposta simulada de referência para verificar o fluxo.",
            fullurl:
              "https://pt.wikipedia.org/wiki/" +
              (brazil ? "Brasil" : "Semicondutor"),
            revisions: [{ timestamp: "2026-01-01T12:00:00Z" }],
          },
        ],
      },
    });
  }
  return original(input, options);
};
