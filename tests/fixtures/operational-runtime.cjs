// Test-only bootstrap. Never import from application code or use outside loopback tests.
if (
  process.env.JARVIS_OPERATIONAL_TEST_FIXTURE !== "1" ||
  !process.argv.includes("127.0.0.1")
)
  throw new Error(
    "Operational fixture requires explicit loopback test execution",
  );
const { createCipheriv } = require("node:crypto");
const key = Buffer.alloc(32, 7),
  iv = Buffer.alloc(12, 1),
  cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([
  cipher.update(
    JSON.stringify([
      { role: "user", content: "CONTEUDO_INTERNO_DE_TESTE_NAO_EXIBIR" },
    ]),
    "utf8",
  ),
  cipher.final(),
]);
const ciphertext = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
  "base64",
);
Object.assign(process.env, {
  JARVIS_SESSION_SECRET: "jarvis-operational-test-session-only-2026",
  VERCEL_ENV: "preview",
  ABACUS_API_KEY: "fake-abacus-operational-test",
  JARVIS_ABACUS_PAID_ALLOWED: "false",
  JARVIS_ABACUS_MAX_CALLS_PER_HOUR: "2",
  SUPABASE_URL: "https://fake-operational.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "fake-supabase-operational-test",
  JARVIS_MEMORY_ENCRYPTION_KEY: key.toString("base64"),
  OPENAI_API_KEY: "",
  GITHUB_READ_TOKEN: "",
  VERCEL_API_TOKEN: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  MICROSOFT_CLIENT_ID: "",
  MICROSOFT_CLIENT_SECRET: "",
  N8N_BASE_URL: "",
  N8N_API_KEY: "",
  WINDOWS_AGENT_BASE_URL: "",
  WINDOWS_AGENT_SHARED_SECRET: "",
});
const original = globalThis.fetch;
globalThis.fetch = async (input, options = {}) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://routellm.abacus.ai/v1/models") {
    if ((options.method || "GET") !== "GET")
      throw new Error("Only metadata GET allowed");
    return Response.json({ data: [{ id: "route-llm" }] });
  }
  if (
    url.startsWith(
      "https://fake-operational.supabase.co/rest/v1/jarvis_owner_memory?",
    )
  ) {
    if ((options.method || "GET") !== "GET")
      throw new Error("Memory writes forbidden by operational fixture");
    return Response.json([{ encrypted_history: ciphertext }]);
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(url))
    return original(input, options);
  throw new Error("External execution blocked by operational test fixture");
};
