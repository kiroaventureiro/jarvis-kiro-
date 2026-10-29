export type ConnectionState =
  | "planned"
  | "available"
  | "authorized"
  | "verified"
  | "expired"
  | "error";
export type ConnectionDraft = {
  id: string;
  name: string;
  category: string;
  purpose: string;
  accountLabel: string;
  context: "personal" | "professional";
  permissions: string;
  state: "planned";
};
export const connectionLabels: Record<ConnectionState, string> = {
  planned: "Planejada",
  available: "Disponível",
  authorized: "Autorizada",
  verified: "Verificada",
  expired: "Expirada",
  error: "Com erro",
};
export const DRAFT_STORAGE_KEY = "jarvis.connection-drafts.v1";
const allowed = new Set([
  "name",
  "category",
  "purpose",
  "accountLabel",
  "context",
  "permissions",
]);
const secretPattern =
  /(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|Bearer\s+\S+|(?:api[_ -]?key|password|senha|token|secret|segredo)\s*[:=]\s*\S+)/i;
export function validateConnection(
  input: unknown,
  id: string,
): ConnectionDraft {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Cadastro inválido.");
  const source = input as Record<string, unknown>;
  if (Object.keys(source).some((key) => !allowed.has(key)))
    throw new Error("Campos não permitidos.");
  const read = (key: string, max: number, required = false) => {
    const value = source[key];
    if (
      typeof value !== "string" ||
      value.length > max ||
      (required && !value.trim())
    )
      throw new Error("Revise os campos do cadastro.");
    if (secretPattern.test(value))
      throw new Error("Não inclua senhas, tokens ou chaves neste cadastro.");
    return value.trim();
  };
  const context = source.context;
  if (context !== "personal" && context !== "professional")
    throw new Error("Escolha o contexto da conta.");
  return {
    id,
    name: read("name", 80, true),
    category: read("category", 80, true),
    purpose: read("purpose", 500, true),
    accountLabel: read("accountLabel", 80),
    context,
    permissions: read("permissions", 500),
    state: "planned",
  };
}
export function restoreDrafts(raw: string | null): ConnectionDraft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: ConnectionDraft) => {
      try {
        if (typeof entry.id !== "string" || entry.id.length > 80) return [];
        return [
          validateConnection(
            {
              name: entry.name,
              category: entry.category,
              purpose: entry.purpose,
              accountLabel: entry.accountLabel,
              context: entry.context,
              permissions: entry.permissions,
            },
            entry.id,
          ),
        ];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
