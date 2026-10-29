import {
  ConnectorError,
  type Provider,
  type Credentials,
  type Resource,
  type Action,
  type Call,
} from "./types";
import { filePath, sha, redact } from "./security";
import { sqlFor } from "./actions";
export const record = (x: unknown): Record<string, any> =>
  x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, any>)
    : {};
const array = (x: unknown) => (Array.isArray(x) ? x : []);
const s = (x: unknown) => (typeof x === "string" ? x : "");
const team = (c: Credentials, prefix = "?") =>
  c.teamId ? prefix + "teamId=" + encodeURIComponent(c.teamId) : "";
export async function discover(
  p: Provider,
  c: Credentials,
  call: Call,
  page = 1,
) {
  let account = "",
    scopes: string[] = [],
    resources: Resource[] = [];
  if (p === "github") {
    const user = record(await call(p, c, "/user"));
    account = s(user.login);
    const repos = array(
      await call(p, c, "/user/repos?per_page=100&sort=updated&page=" + page),
    );
    resources = repos
      .map((x) => {
        const r = record(x);
        return {
          id: s(r.full_name),
          name: s(r.full_name),
          environment: "development" as const,
          defaultBranch: s(r.default_branch),
          repoId: Number(r.id),
        };
      })
      .filter((r) => r.id && r.repoId);
  } else if (p === "supabase") {
    resources = array(await call(p, c, "/v1/projects"))
      .slice(0, 200)
      .map((x) => {
        const r = record(x);
        return {
          id: s(r.id),
          name: s(r.name),
          environment: "production" as const,
        };
      })
      .filter((r) => r.id);
    account = "Conta Supabase autorizada";
  } else {
    const result = record(
      await call(p, c, "/v9/projects?limit=100" + team(c, "&")),
    );
    resources = array(result.projects)
      .map((x) => {
        const r = record(x);
        return {
          id: s(r.id),
          name: s(r.name),
          environment: "preview" as const,
          ...(c.teamId ? { teamId: c.teamId } : {}),
        };
      })
      .filter((r) => r.id);
    account = c.teamId ? "Equipe Vercel autorizada" : "Conta Vercel autorizada";
    if (c.configurationId) {
      const config = record(
        await call(
          p,
          c,
          "/v1/integrations/configuration/" +
            encodeURIComponent(c.configurationId) +
            team(c),
        ),
      );
      scopes = array(config.scopes).filter((x) => typeof x === "string");
      if (config.disabled) throw new ConnectorError("UPSTREAM_AUTH", 403);
    }
  }
  return {
    account,
    resources,
    providerScopes: scopes,
    truncated: resources.length >= 100,
  };
}
export function createAdapters(call: Call) {
  return async function execute(
    action: Action,
    c: Credentials,
    resource: Resource,
  ): Promise<unknown> {
    const { provider: p, operation: op, args: a } = action;
    if (p === "github") {
      const base =
        "/repos/" +
        action.resource.split("/").map(encodeURIComponent).join("/");
      if (op === "repo") {
        const r = record(await call(p, c, base));
        return {
          id: r.id,
          name: r.full_name,
          defaultBranch: r.default_branch,
          description: r.description,
        };
      }
      if (op === "file") {
        const r = record(
          await call(
            p,
            c,
            base +
              "/contents/" +
              filePath(a.path).split("/").map(encodeURIComponent).join("/") +
              (a.ref ? "?ref=" + encodeURIComponent(s(a.ref)) : ""),
          ),
        );
        if (
          r.type !== "file" ||
          r.encoding !== "base64" ||
          Number(r.size) > 40000
        )
          throw new ConnectorError("FILE_LIMIT");
        const bytes = Buffer.from(s(r.content), "base64");
        if (bytes.length > 40000) throw new ConnectorError("FILE_LIMIT");
        return {
          path: r.path,
          sha: r.sha,
          content: bytes.toString("utf8"),
          untrusted: true,
        };
      }
      if (["branches", "commits", "issues", "pulls"].includes(op)) {
        const data = array(await call(p, c, base + "/" + op + "?per_page=30"));
        return data.map((v) => {
          const r = record(v);
          return op === "branches"
            ? { name: r.name, sha: r.commit?.sha }
            : op === "commits"
              ? { sha: r.sha, message: r.commit?.message }
              : {
                  number: r.number,
                  title: r.title,
                  body: s(r.body).slice(0, 4000),
                  state: r.state,
                  url: r.html_url,
                };
        });
      }
      if (op === "workflow_safety") {
        const workflows = array(
          record(await call(p, c, base + "/actions/workflows?per_page=30"))
            .workflows,
        );
        let isolated = workflows.length > 0;
        const names: string[] = [];
        for (const workflow of workflows.slice(0, 10)) {
          const path = filePath(workflow.path),
            file = record(
              await call(
                p,
                c,
                base +
                  "/contents/" +
                  path.split("/").map(encodeURIComponent).join("/") +
                  "?ref=" +
                  sha(a.sha),
              ),
            );
          const source = Buffer.from(s(file.content), "base64").toString(
            "utf8",
          );
          names.push(s(workflow.name));
          const runners = [
            ...source.matchAll(/^\s*runs-on\s*:[ \t]*([^\n]+)/gm),
          ].map((m) => m[1].trim().replace(/["']/g, ""));
          if (
            !runners.length ||
            /uses:[ \t]*[\w.\/-]*\.github\/workflows\//.test(source) ||
            source.includes("self-hosted") ||
            runners.some(
              (r) =>
                !/^(ubuntu|windows|macos)-(latest|[0-9]+(?:\.[0-9]+)?)$/.test(
                  r,
                ),
            ) ||
            workflows.length > 10
          )
            isolated = false;
        }
        return {
          isolated,
          workflows: names,
          note: isolated
            ? "Runners hospedados identificados no código base; resultados ainda precisam ser consultados."
            : "Isolamento do CI não confirmado. Correção automática bloqueada.",
        };
      }
      if (op === "checks") {
        const exact = sha(a.sha);
        const [runs, status] = await Promise.all([
          call(p, c, base + "/commits/" + exact + "/check-runs?per_page=100"),
          call(p, c, base + "/commits/" + exact + "/status"),
        ]);
        const checks = array(record(runs).check_runs).map((x) => ({
            name: x.name,
            status: x.status,
            conclusion: x.conclusion,
          })),
          statuses = array(record(status).statuses).map((x) => ({
            name: x.context,
            state: x.state,
          }));
        const all = checks.length + statuses.length > 0,
          failed =
            checks.some(
              (x) =>
                x.status === "completed" &&
                !["success", "neutral", "skipped"].includes(x.conclusion),
            ) || statuses.some((x) => ["failure", "error"].includes(x.state));
        const passed =
          all &&
          !failed &&
          checks.every(
            (x) => x.status === "completed" && x.conclusion === "success",
          ) &&
          statuses.every((x) => x.state === "success");
        return {
          sha: exact,
          checks,
          statuses,
          passed,
          failed,
          waiting: !failed && !passed,
          testsConfirmed: passed,
        };
      }
      if (op === "branch") {
        sha(a.baseSha);
        const metadata = record(await call(p, c, base));
        if (a.branch === metadata.default_branch)
          throw new ConnectorError("PRODUCTION_BLOCKED");
        const r = record(
          await call(p, c, base + "/git/refs", {
            method: "POST",
            body: { ref: "refs/heads/" + a.branch, sha: a.baseSha },
          }),
        );
        if (r.ref !== "refs/heads/" + a.branch || r.object?.sha !== a.baseSha)
          throw new ConnectorError("UPSTREAM_INVALID", 502);
        return { branch: a.branch, sha: r.object.sha };
      }
      if (op === "commit") {
        const metadata = record(await call(p, c, base));
        if (a.branch === metadata.default_branch)
          throw new ConnectorError("PRODUCTION_BLOCKED", 403);
        const branch = encodeURIComponent(String(a.branch)),
          ref = record(await call(p, c, base + "/git/ref/heads/" + branch));
        if (ref.object?.sha !== a.baseSha)
          throw new ConnectorError("BRANCH_CHANGED", 409);
        const commit = record(
          await call(p, c, base + "/git/commits/" + sha(a.baseSha)),
        );
        const files = a.files as { path: string; content: string }[];
        const tree = record(
          await call(p, c, base + "/git/trees", {
            method: "POST",
            body: {
              base_tree: sha(commit.tree?.sha),
              tree: files.map((f) => ({
                path: f.path,
                mode: "100644",
                type: "blob",
                content: f.content,
              })),
            },
          }),
        );
        const created = record(
          await call(p, c, base + "/git/commits", {
            method: "POST",
            body: {
              message: a.message,
              tree: sha(tree.sha),
              parents: [a.baseSha],
            },
          }),
        );
        sha(created.sha);
        const updated = record(
          await call(p, c, base + "/git/refs/heads/" + branch, {
            method: "PATCH",
            body: { sha: created.sha, force: false },
          }),
        );
        if (updated.object?.sha !== created.sha)
          throw new ConnectorError("UPSTREAM_INVALID", 502);
        return {
          sha: created.sha,
          branch: a.branch,
          files: files.map((f) => f.path),
        };
      }
      if (op === "pull") {
        const r = record(
          await call(p, c, base + "/pulls", {
            method: "POST",
            body: {
              head: a.branch,
              base: a.base,
              title: a.title,
              body: a.body,
              draft: true,
            },
          }),
        );
        if (!Number.isSafeInteger(r.number) || r.number < 1 || r.draft !== true)
          throw new ConnectorError("UPSTREAM_INVALID", 502);
        return {
          number: r.number,
          url: "https://github.com/" + action.resource + "/pull/" + r.number,
          draft: true,
        };
      }
    }
    if (p === "supabase") {
      const base = "/v1/projects/" + encodeURIComponent(action.resource);
      if (op === "schemas")
        return call(p, c, base + "/database/query/read-only", {
          method: "POST",
          body: {
            query:
              "select table_schema, table_name from information_schema.tables where table_schema = 'public' order by table_name limit 100",
          },
        });
      if (op === "diagnostics") return call(p, c, base + "/advisors/security");
      if (op === "logs") {
        const query = new URLSearchParams({
          sql: "select timestamp, id, event_message from logs where source = 'postgres_logs' order by timestamp desc limit 30",
          iso_timestamp_start: new Date(Date.now() - 900000).toISOString(),
          iso_timestamp_end: new Date().toISOString(),
        });
        return call(p, c, base + "/analytics/endpoints/logs?" + query);
      }
      if (op === "select")
        return call(p, c, base + "/database/query/read-only", {
          method: "POST",
          body: { query: sqlFor(action) },
        });
      if (op === "create_table")
        return call(p, c, base + "/database/migrations", {
          method: "POST",
          body: {
            name: "jk_" + a.table + "_" + Date.now(),
            query: sqlFor(action),
          },
        });
      if (["insert", "update", "delete"].includes(op))
        return call(p, c, base + "/database/query", {
          method: "POST",
          body: { query: sqlFor(action) },
        });
    }
    if (p === "vercel") {
      const base = "/v9/projects/" + encodeURIComponent(action.resource);
      if (op === "project") {
        const r = record(await call(p, c, base + team(c)));
        return {
          id: r.id,
          name: r.name,
          framework: r.framework,
          link: {
            type: r.link?.type,
            repoId: r.link?.repoId,
            productionBranch: r.link?.productionBranch,
          },
        };
      }
      if (op === "deployments") {
        const r = record(
          await call(
            p,
            c,
            "/v6/deployments?projectId=" +
              encodeURIComponent(action.resource) +
              "&limit=20" +
              team(c, "&"),
          ),
        );
        return array(r.deployments).map((d) => ({
          id: d.uid || d.id,
          state: d.state,
          url: d.url,
          target: d.target,
          sha: d.meta?.githubCommitSha,
        }));
      }
      if (op === "build_logs" || op === "runtime_logs") {
        const deployment = record(
          await call(
            p,
            c,
            "/v13/deployments/" + encodeURIComponent(s(a.deployment)) + team(c),
          ),
        );
        if (deployment.projectId !== resource.id)
          throw new ConnectorError("PERMISSION_DENIED", 403);
        if (op === "runtime_logs")
          return {
            availableVia: "provider_dashboard",
            url: "https://vercel.com/dashboard",
            note: "Consulta direta de runtime não implementada; use o painel oficial. Nenhum serviço de logs contratado.",
          };
        const events = await call(
          p,
          c,
          "/v3/deployments/" +
            encodeURIComponent(s(a.deployment)) +
            "/events?limit=100&direction=backward&follow=0" +
            team(c, "&"),
        );
        return array(events).map((e) => ({
          type: e.type,
          created: e.created,
          text: e.text || e.payload?.text,
        }));
      }
      if (op === "preview") {
        const project = record(await call(p, c, base + team(c)));
        if (
          project.link?.type !== "github" ||
          Number(project.link.repoId) !== a.repoId ||
          project.link.productionBranch === a.branch
        )
          throw new ConnectorError("PROJECT_LINK_MISMATCH", 403);
        const r = record(
          await call(p, c, "/v13/deployments" + team(c), {
            method: "POST",
            body: {
              name: project.name,
              project: resource.id,
              gitSource: {
                type: "github",
                repoId: String(a.repoId),
                ref: a.branch,
                sha: sha(a.sha),
              },
            },
          }),
        );
        if (r.target && r.target !== "preview")
          throw new ConnectorError("UNCERTAIN_RESULT", 502);
        return { id: r.id, url: r.url, state: r.readyState, target: "preview" };
      }
      if (op === "preview_env") {
        await call(
          p,
          c,
          "/v10/projects/" + encodeURIComponent(resource.id) + "/env" + team(c),
          {
            method: "POST",
            body: {
              key: a.key,
              value: a.value,
              type: "encrypted",
              target: ["preview"],
              gitBranch: a.branch,
            },
          },
        );
        return {
          key: a.key,
          branch: a.branch,
          target: "preview",
          created: true,
        };
      }
    }
    throw new ConnectorError("OPERATION_BLOCKED");
  };
}
