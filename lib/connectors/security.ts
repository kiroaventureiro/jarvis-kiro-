import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { ConnectorError, type Provider, type Action } from "./types";
export function provider(value: unknown): Provider {
  if (value !== "github" && value !== "supabase" && value !== "vercel")
    throw new ConnectorError("PROVIDER_INVALID");
  return value;
}
export function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ":" +
            canonical((value as Record<string, unknown>)[k]),
        )
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export function encrypt(value: unknown, key: Buffer, aad: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
export function decrypt<T>(value: string, key: Buffer, aad: string): T {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 29) throw new ConnectorError("VAULT_CORRUPT", 503);
  const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(bytes.subarray(12, 28));
  try {
    return JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(28)),
        cipher.final(),
      ]).toString("utf8"),
    ) as T;
  } catch {
    throw new ConnectorError("VAULT_CORRUPT", 503);
  }
}
export function identifier(x: unknown) {
  if (
    typeof x !== "string" ||
    !/[a-zA-Z]/.test(x) ||
    !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(x)
  )
    throw new ConnectorError("IDENTIFIER_INVALID");
  return x;
}
export function resourceId(x: unknown) {
  if (
    typeof x !== "string" ||
    !/^[a-zA-Z0-9_.\/-]{1,150}$/.test(x) ||
    x.includes("..")
  )
    throw new ConnectorError("RESOURCE_INVALID");
  return x;
}
export function filePath(x: unknown) {
  if (
    typeof x !== "string" ||
    !x ||
    x.length > 240 ||
    x.startsWith("/") ||
    x.includes("\\") ||
    x.split("/").some((p) => !p || p === "." || p === "..") ||
    /[\x00-\x1f?#%]/.test(x) ||
    /(^|\/)(\.git|\.env(?:\..*)?|.*\.(?:pem|key|p12)|credentials.*|secrets.*)(\/|$)/i.test(
      x,
    )
  )
    throw new ConnectorError("PATH_BLOCKED");
  return x;
}
export function devBranch(x: unknown) {
  if (typeof x !== "string" || !/^jk\/[a-z0-9][a-z0-9-]{2,70}$/.test(x))
    throw new ConnectorError("DEVELOPMENT_BRANCH_REQUIRED");
  return x;
}
export function sha(x: unknown) {
  if (typeof x !== "string" || !/^[a-f0-9]{40}$/.test(x))
    throw new ConnectorError("COMMIT_INVALID");
  return x;
}
export function safeText(x: unknown, max = 2000) {
  if (typeof x !== "string" || x.length > max || !x.trim())
    throw new ConnectorError("TEXT_INVALID");
  return x;
}
export function redact(value: unknown, secrets: string[] = []): unknown {
  if (typeof value === "string") {
    let s = value;
    for (const token of secrets.filter((s) => s.length >= 6))
      s = s.split(token).join("[redacted]");
    return s
      .replace(
        /(?:gh[pousr]_[a-zA-Z0-9_]{10,}|github_pat_[a-zA-Z0-9_]+|sb_secret_[a-zA-Z0-9_-]+|sk-[a-zA-Z0-9_-]{12,}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g,
        "[redacted]",
      )
      .replace(
        /((?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)[^\s,;]+/gi,
        "$1[redacted]",
      )
      .slice(0, 48000);
  }
  if (Array.isArray(value))
    return value.slice(0, 100).map((v) => redact(v, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([k, v]) => [
          k,
          /(?:token|secret|password|authorization|apikey|api_key|encrypted)/i.test(
            k,
          )
            ? "[redacted]"
            : redact(v, secrets),
        ]),
    );
  return value;
}
export function actionDigest(
  actions: Action[],
  revisions: unknown,
  environment: string,
) {
  return hash(canonical({ actions, revisions, environment }));
}
export function originAllowed(request: Request, canonicalOrigin?: string) {
  const origin = request.headers.get("origin");
  const allowed = canonicalOrigin || new URL(request.url).origin;
  return (
    !!origin &&
    origin === allowed &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function jsonBody(request: Request, max = 180000) {
  const reader = request.body?.getReader();
  if (!reader) throw new ConnectorError("BODY_INVALID");
  let size = 0,
    raw = "";
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new ConnectorError("BODY_LIMIT", 413);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const data = JSON.parse(raw);
    if (!data || Array.isArray(data) || typeof data !== "object") throw Error();
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    throw new ConnectorError("BODY_INVALID");
  } finally {
    reader.releaseLock();
  }
}
export const messages: Record<string, string> = {
  MODEL_NOT_CONFIGURED: "O provedor da proposta ainda não está configurado.",
  MODEL_APPROVAL_REQUIRED:
    "A proposta por IA depende da política de custos já autorizada no servidor.",
  MODEL_BUDGET_BLOCKED:
    "O orçamento de chamadas não permite preparar outra proposta agora.",
  REPAIR_DRAFT_TRUNCATED:
    "A proposta excedeu o limite de resposta. Reduza a correção solicitada.",
  REPAIR_DRAFT_INVALID:
    "A IA não retornou uma proposta válida. Nenhuma gravação foi executada.",
  CI_ISOLATION_REQUIRED:
    "Não foi possível confirmar os runners hospedados do CI. A correção automática foi bloqueada.",
  PROJECT_BINDING_REQUIRED:
    "Vincule um repositório autorizado a este projeto KIRO na Central.",
  SCOPE_CHANGED: "O escopo mudou. Prepare e aprove um novo plano.",
  PLAN_BUSY:
    "Este plano já está em execução ou terminou. Atualize seu estado antes de continuar.",
  TESTS_FAILED: "Os testes do CI falharam; o Preview explícito foi bloqueado.",
  VAULT_NOT_CONFIGURED:
    "Configure o cofre dedicado no servidor antes de conectar contas.",
  VAULT_UNAVAILABLE:
    "O cofre está indisponível; nenhuma operação foi autorizada.",
  VAULT_CONFLICT: "Outra operação alterou o estado. Atualize a página.",
  PERMISSION_DENIED: "Operação fora das permissões ou projetos autorizados.",
  APP_NOT_CONFIGURED:
    "O aplicativo OAuth deste provedor ainda precisa ser cadastrado pelo proprietário.",
  APP_ORIGIN_REQUIRED: "Configure uma URL estável para os callbacks OAuth.",
  UPSTREAM_AUTH: "A autorização do provedor expirou ou foi revogada.",
  UPSTREAM_RATE_LIMIT:
    "Limite do provedor atingido. Nenhuma repetição automática foi feita.",
  UPSTREAM_UNAVAILABLE:
    "O provedor não confirmou a operação. Confira o histórico.",
  APPROVAL_REQUIRED: "Revise e aprove este plano na Central de Conexões.",
  PLAN_EXPIRED: "O plano expirou. Prepare uma nova proposta.",
  PRODUCTION_BLOCKED: "Operações em produção estão bloqueadas neste conector.",
  UNCERTAIN_RESULT:
    "Resultado incerto; confirme no provedor antes de preparar outra operação.",
};
export function publicError(e: unknown) {
  const error =
    e instanceof ConnectorError ? e : new ConnectorError("UNAVAILABLE", 503);
  return {
    code: error.code,
    error:
      messages[error.code] ||
      "Não foi possível concluir a operação com segurança.",
    status: error.status,
  };
}
