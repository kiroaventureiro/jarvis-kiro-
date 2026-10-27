// Test-only transport fixture. No application imports this file.
if (
  process.env.JARVIS_CONNECTORS_TEST_FIXTURE !== "1" ||
  !process.argv.some((arg) => ["127.0.0.1", "localhost"].includes(arg))
)
  throw Error("Explicit loopback fixture required");
const fs = require("node:fs");
const key = Buffer.alloc(32, 8).toString("base64"),
  A = "a".repeat(40),
  B = "b".repeat(40),
  C = "c".repeat(40),
  D = "d".repeat(40);
Object.assign(process.env, {
  JARVIS_SESSION_SECRET: "jk-connectors-session-fixture-only-2026",
  JARVIS_ACCESS_PASSWORD: "fixture-owner-only",
  VERCEL_ENV: "preview",
  JARVIS_CONNECTOR_STORE_URL: "https://fixture-connectors.supabase.co",
  JARVIS_CONNECTOR_STORE_KEY: "fixture-only-vault-key",
  JARVIS_CONNECTOR_ENCRYPTION_KEY: key,
  JARVIS_CONNECTOR_NAMESPACE: "connector-browser-test",
  JARVIS_CONNECTOR_ORIGIN: "http://localhost:3156",
  JARVIS_CONNECTOR_WRITE_RESOURCES: JSON.stringify({
    github: ["owner/project"],
    supabase: ["dev-project"],
    vercel: ["prj_dev"],
  }),
  JARVIS_DEV_GITHUB_CLIENT_ID: "fixture-github-app",
  JARVIS_DEV_GITHUB_CLIENT_SECRET: "fixture-github-secret",
  JARVIS_DEV_SUPABASE_CLIENT_ID: "fixture-supabase-app",
  JARVIS_DEV_SUPABASE_CLIENT_SECRET: "fixture-supabase-secret",
  JARVIS_DEV_VERCEL_CLIENT_ID: "fixture-vercel-app",
  JARVIS_DEV_VERCEL_CLIENT_SECRET: "fixture-vercel-secret",
  JARVIS_DEV_VERCEL_INTEGRATION_SLUG: "fixture-jk",
  ABACUS_API_KEY: "",
  OPENAI_API_KEY: "",
  JARVIS_ABACUS_PAID_ALLOWED: "false",
  JARVIS_OPENAI_PAID_ALLOWED: "false",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  JARVIS_MEMORY_ENCRYPTION_KEY: "",
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
let row = null;
const branches = new Map([["jk/browser", A]]),
  original = globalThis.fetch;
function response(x, status = 200) {
  return Response.json(x, { status });
}
globalThis.fetch = async (input, options = {}) => {
  const raw =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    u = new URL(raw),
    method = options.method || "GET";
  if (["localhost", "127.0.0.1"].includes(u.hostname))
    return original(input, options);
  if (u.hostname === "fixture-connectors.supabase.co") {
    if (u.pathname != "/rest/v1/jarvis_connector_state")
      throw Error("Unknown fixture table");
    if (method === "GET")
      return response(
        row ? [{ revision: row.revision, ciphertext: row.ciphertext }] : [],
      );
    const body = JSON.parse(options.body);
    if (method === "POST") {
      if (row) return response({}, 409);
      row = body;
      return response([row]);
    }
    if (method === "PATCH") {
      if (!row || u.searchParams.get("revision") !== "eq." + row.revision)
        return response([]);
      row = { ...row, ...body };
      return response([row]);
    }
    throw Error("Unsupported vault operation");
  }
  if (process.env.CONNECTOR_FIXTURE_AUDIT)
    fs.appendFileSync(
      process.env.CONNECTOR_FIXTURE_AUDIT,
      JSON.stringify({ host: u.hostname, path: u.pathname, method }) + "\n",
    );
  const p = u.pathname,
    body =
      typeof options.body === "string" && options.body.startsWith("{")
        ? JSON.parse(options.body)
        : {};
  if (u.hostname === "github.com" && p === "/login/oauth/access_token")
    return response({
      access_token: "ghp_fake_browser_oauth_123456789",
      refresh_token: "fixture-refresh-token",
      expires_in: 3600,
    });
  if (u.hostname === "api.github.com") {
    if (p === "/user") return response({ login: "owner-fixture" });
    if (p === "/user/repos")
      return response([
        { id: 101, full_name: "owner/project", default_branch: "main" },
      ]);
    if (p.includes("/check-runs"))
      return response({
        check_runs: [
          { name: "simulated-ci", status: "completed", conclusion: "success" },
        ],
      });
    if (p.endsWith("/status")) return response({ statuses: [] });
    if (p.includes("/contents/")) {
      const path = p.split("/contents/")[1],
        content = "export const answer = 1;\n";
      return response({
        type: "file",
        encoding: "base64",
        size: content.length,
        path,
        sha: A,
        content: Buffer.from(content).toString("base64"),
      });
    }
    if (p.endsWith("/git/refs") && method === "POST") {
      branches.set(body.ref.slice(11), body.sha);
      return response({ ref: body.ref, object: { sha: body.sha } });
    }
    if (p.includes("/git/ref/heads/"))
      return response({
        object: {
          sha: branches.get(decodeURIComponent(p.split("/heads/")[1])),
        },
      });
    if (p.includes("/git/refs/heads/") && method === "PATCH") {
      branches.set(decodeURIComponent(p.split("/heads/")[1]), body.sha);
      return response({ object: { sha: body.sha } });
    }
    if (p.endsWith("/git/trees")) return response({ sha: D });
    if (p.endsWith("/git/commits") && method === "POST")
      return response({ sha: B });
    if (p.includes("/git/commits/"))
      return response({ sha: A, tree: { sha: C } });
    if (p.endsWith("/pulls") && method === "POST")
      return response({ number: 7, draft: true });
    if (p.endsWith("/branches"))
      return response([{ name: "main", commit: { sha: A } }]);
    if (p.endsWith("/commits"))
      return response([{ sha: A, commit: { message: "Fixture base" } }]);
    if (p.endsWith("/issues") || p.endsWith("/pulls")) return response([]);
    if (p === "/repos/owner/project")
      return response({
        id: 101,
        full_name: "owner/project",
        default_branch: "main",
        description: "SIMULATED TEST RESOURCE",
      });
    throw Error("Unknown GitHub fixture endpoint");
  }
  if (u.hostname === "api.supabase.com") {
    if (p === "/v1/projects")
      return response([{ id: "dev-project", name: "Database fixture" }]);
    if (p.endsWith("/database/query/read-only"))
      return response([{ id: 1, title: "simulated result" }]);
    if (p.endsWith("/database/migrations") || p.endsWith("/database/query"))
      return response([]);
    if (p.endsWith("/advisors/security")) return response({ lints: [] });
    if (p.includes("/analytics/endpoints/logs"))
      return response({ result: [] });
    throw Error("Unknown Supabase fixture endpoint");
  }
  if (u.hostname === "api.vercel.com") {
    if (p === "/v9/projects")
      return response({
        projects: [{ id: "prj_dev", name: "development-fixture" }],
      });
    if (p === "/v9/projects/prj_dev")
      return response({
        id: "prj_dev",
        name: "development-fixture",
        link: { type: "github", repoId: 101, productionBranch: "main" },
      });
    if (p === "/v6/deployments") return response({ deployments: [] });
    if (p === "/v13/deployments" && method === "POST")
      return response({
        id: "dpl_fixture",
        url: "fixture.invalid",
        target: null,
        readyState: "BUILDING",
      });
    if (p.startsWith("/v13/deployments/"))
      return response({ id: "dpl_fixture", projectId: "prj_dev" });
    if (p.includes("/events"))
      return response([{ type: "stdout", text: "SIMULATED build log" }]);
    if (p === "/v10/projects/prj_dev/env") return response({ created: [] });
    throw Error("Unknown Vercel fixture endpoint");
  }
  throw Error("External network blocked by connector fixture");
};
