import { ConnectorError, type Action } from "./types";
import {
  provider,
  resourceId,
  filePath,
  devBranch,
  sha,
  safeText,
  identifier,
} from "./security";
import { operation } from "./catalog";
const object = (x: unknown) => {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new ConnectorError("ARGS_INVALID");
  return x as Record<string, unknown>;
};
const text = (x: unknown, max = 2000) => safeText(x, max);
export function normalizeAction(value: unknown): Action {
  const raw = object(value),
    p = provider(raw.provider),
    resource = resourceId(raw.resource),
    id = text(raw.operation, 40),
    input = object(raw.args || {}),
    definition = operation(p, id);
  if (!definition) throw new ConnectorError("OPERATION_BLOCKED");
  const allowed: Record<string, string[]> = {
    repo: [],
    file: ["path", "ref"],
    branches: [],
    commits: [],
    issues: [],
    pulls: [],
    workflow_safety: ["sha"],
    checks: ["sha", "waitForSuccess"],
    branch: ["branch", "baseSha"],
    commit: ["branch", "baseSha", "message", "path", "content", "files"],
    pull: ["branch", "base", "title", "body"],
    schemas: [],
    select: ["table", "columns", "limit"],
    diagnostics: [],
    logs: [],
    create_table: ["table", "columns"],
    insert: ["table", "values"],
    update: ["table", "id", "values"],
    delete: ["table", "id"],
    project: [],
    deployments: [],
    build_logs: ["deployment"],
    runtime_logs: ["deployment"],
    preview: ["repoId", "branch", "sha"],
    preview_env: ["branch", "key", "value"],
  };
  if (
    Object.keys(raw).some(
      (k) => !["provider", "resource", "operation", "args"].includes(k),
    ) ||
    Object.keys(input).some((k) => !allowed[id]?.includes(k))
  )
    throw new ConnectorError("ARGS_INVALID");
  let args: Record<string, unknown> = {};
  const commitRef = (x: unknown) => (x === "$commit" ? "$commit" : sha(x));
  if (p === "github") {
    if (!/^[\w.-]+\/[\w.-]+$/.test(resource))
      throw new ConnectorError("RESOURCE_INVALID");
    if (id === "file")
      args = {
        path: filePath(input.path),
        ...(input.ref ? { ref: text(input.ref, 120) } : {}),
      };
    if (id === "workflow_safety") args = { sha: sha(input.sha) };
    if (id === "checks")
      args = {
        sha: commitRef(input.sha),
        waitForSuccess: input.waitForSuccess === true,
      };
    if (id === "branch")
      args = { branch: devBranch(input.branch), baseSha: sha(input.baseSha) };
    if (id === "commit") {
      const files = Array.isArray(input.files)
        ? input.files
        : [{ path: input.path, content: input.content }];
      if (!files.length || files.length > 6)
        throw new ConnectorError("FILES_LIMIT");
      args = {
        branch: devBranch(input.branch),
        baseSha: sha(input.baseSha),
        message: text(input.message, 160),
        files: files.map((f) => {
          const v = object(f),
            path = filePath(v.path);
          if (
            path.startsWith(".github/") ||
            /^(?:vercel\.json|next\.config\.|package(?:-lock)?\.json)/.test(
              path,
            )
          )
            throw new ConnectorError("SENSITIVE_FILE_BLOCKED");
          return {
            path,
            content:
              typeof v.content === "string" && v.content.length <= 24000
                ? v.content
                : (() => {
                    throw new ConnectorError("FILE_LIMIT");
                  })(),
          };
        }),
      };
      if (
        new Set((args.files as { path: string }[]).map((f) => f.path)).size !==
        files.length
      )
        throw new ConnectorError("FILES_DUPLICATED");
    }
    if (id === "pull")
      args = {
        branch: devBranch(input.branch),
        base: text(input.base, 120),
        title: text(input.title, 160),
        body: text(input.body, 4000),
      };
  } else if (p === "supabase") {
    if (!/^[a-z0-9-]{5,60}$/.test(resource))
      throw new ConnectorError("RESOURCE_INVALID");
    if (["select", "create_table", "insert", "update", "delete"].includes(id)) {
      const table = identifier(input.table);
      if (
        /(?:secret|token|credential|password)|^jarvis_(?:connector|owner_memory|passkey)/i.test(
          table,
        )
      )
        throw new ConnectorError("TABLE_BLOCKED");
      args.table = table;
    }
    if (id === "select") {
      const cols = text(input.columns || "id", 1000)
        .split(",")
        .map((c) => identifier(c.trim()));
      if (cols.length > 20) throw new ConnectorError("COLUMNS_LIMIT");
      args = {
        ...args,
        columns: cols,
        limit: Math.min(
          100,
          Math.max(
            1,
            Number.isFinite(Number(input.limit))
              ? Math.floor(Number(input.limit))
              : 20,
          ),
        ),
      };
    }
    if (id === "create_table") {
      const cols = text(input.columns, 3000)
        .split(/[\n,]/)
        .filter((c) => c.trim())
        .map((c) => {
          const [name, type] = c.trim().split(":");
          identifier(name);
          if (
            ![
              "text",
              "uuid",
              "integer",
              "bigint",
              "boolean",
              "numeric",
              "timestamptz",
              "jsonb",
            ].includes(type)
          )
            throw new ConnectorError("COLUMN_TYPE_BLOCKED");
          return { name, type };
        });
      if (
        !cols.length ||
        cols.length > 20 ||
        new Set(cols.map((c) => c.name)).size !== cols.length
      )
        throw new ConnectorError("COLUMNS_INVALID");
      args.columns = cols;
    }
    if (id === "update" || id === "delete") args.id = text(input.id, 200);
    if (id === "insert" || id === "update") {
      let values: unknown;
      try {
        values =
          typeof input.values === "string"
            ? JSON.parse(input.values)
            : input.values;
      } catch {
        throw new ConnectorError("VALUES_INVALID");
      }
      const v = object(values);
      if (
        !Object.keys(v).length ||
        Object.keys(v).length > 20 ||
        JSON.stringify(v).length > 10000
      )
        throw new ConnectorError("VALUES_LIMIT");
      for (const [key, value] of Object.entries(v)) {
        identifier(key);
        if (
          /password|secret|token|credential/i.test(key) ||
          !(
            value === null ||
            ["string", "number", "boolean"].includes(typeof value)
          )
        )
          throw new ConnectorError("VALUES_BLOCKED");
      }
      args.values = v;
    }
  } else {
    if (!/^prj_[\w-]+$/.test(resource))
      throw new ConnectorError("PROJECT_ID_REQUIRED");
    if (["build_logs", "runtime_logs"].includes(id))
      args.deployment = resourceId(input.deployment);
    if (id === "preview")
      args = {
        repoId: Number(input.repoId),
        branch: devBranch(input.branch),
        sha: commitRef(input.sha),
      };
    if (
      id === "preview" &&
      (!Number.isSafeInteger(args.repoId) || Number(args.repoId) < 1)
    )
      throw new ConnectorError("REPOSITORY_ID_INVALID");
    if (id === "preview_env")
      args = {
        branch: devBranch(input.branch),
        key: identifier(input.key),
        value: text(input.value, 5000),
      };
  }
  return { provider: p, resource, operation: id, args };
}
export function mutation(action: Action) {
  return operation(action.provider, action.operation)!.grant !== "read";
}
export function sqlFor(action: Action) {
  const a = action.args,
    q = (x: unknown) => '"' + identifier(x) + '"',
    lit = (x: unknown) =>
      x === null
        ? "null"
        : typeof x === "number" || typeof x === "boolean"
          ? String(x)
          : "'" + String(x).replace(/'/g, "''") + "'",
    table = '"public".' + q(a.table);
  if (action.operation === "select")
    return (
      "select " +
      (a.columns as string[]).map(q).join(",") +
      " from " +
      table +
      " limit " +
      a.limit
    );
  if (action.operation === "create_table")
    return (
      "create table " +
      table +
      " (" +
      (a.columns as { name: string; type: string }[])
        .map((c) => q(c.name) + " " + c.type)
        .join(",") +
      "); alter table " +
      table +
      " enable row level security; revoke all on " +
      table +
      " from public, anon, authenticated;"
    );
  const vals = a.values as Record<string, unknown>;
  if (action.operation === "insert")
    return (
      "insert into " +
      table +
      " (" +
      Object.keys(vals).map(q).join(",") +
      ") values (" +
      Object.values(vals).map(lit).join(",") +
      ")"
    );
  if (action.operation === "update")
    return (
      "update " +
      table +
      " set " +
      Object.entries(vals)
        .map(([k, v]) => q(k) + "=" + lit(v))
        .join(",") +
      " where ctid=(select ctid from " +
      table +
      " where " +
      q("id") +
      "=" +
      lit(a.id) +
      ") returning " +
      q("id")
    );
  if (action.operation === "delete")
    return (
      "delete from " +
      table +
      " where ctid=(select ctid from " +
      table +
      " where " +
      q("id") +
      "=" +
      lit(a.id) +
      ") returning " +
      q("id")
    );
  throw new ConnectorError("OPERATION_BLOCKED");
}
