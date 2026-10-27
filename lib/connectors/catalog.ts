import type { Provider, Grant } from "./types";
export type Operation = {
  id: string;
  provider: Provider;
  label: string;
  grant: Grant;
  fields: Array<{
    key: string;
    label: string;
    kind?: "text" | "textarea" | "number";
    hint?: string;
    optional?: boolean;
  }>;
};
const field = (
  key: string,
  label: string,
  kind: "text" | "textarea" | "number" = "text",
  hint?: string,
  optional = false,
) => ({ key, label, kind, hint, optional });
export const OPERATIONS: Operation[] = [
  {
    id: "repo",
    provider: "github",
    label: "Consultar repositório",
    grant: "read",
    fields: [],
  },
  {
    id: "file",
    provider: "github",
    label: "Ler arquivo",
    grant: "read",
    fields: [
      field("path", "Caminho do arquivo"),
      field("ref", "Branch ou commit", "text", undefined, true),
    ],
  },
  {
    id: "branches",
    provider: "github",
    label: "Listar branches",
    grant: "read",
    fields: [],
  },
  {
    id: "commits",
    provider: "github",
    label: "Listar commits",
    grant: "read",
    fields: [],
  },
  {
    id: "issues",
    provider: "github",
    label: "Listar issues",
    grant: "read",
    fields: [],
  },
  {
    id: "pulls",
    provider: "github",
    label: "Listar pull requests",
    grant: "read",
    fields: [],
  },
  {
    id: "workflow_safety",
    provider: "github",
    label: "Verificar isolamento do CI",
    grant: "read",
    fields: [field("sha", "SHA base")],
  },
  {
    id: "checks",
    provider: "github",
    label: "Consultar testes de um commit",
    grant: "read",
    fields: [field("sha", "SHA do commit")],
  },
  {
    id: "branch",
    provider: "github",
    label: "Criar branch de desenvolvimento",
    grant: "write",
    fields: [
      field("branch", "Nome da branch", "text", "jk/minha-correcao"),
      field("baseSha", "SHA base"),
    ],
  },
  {
    id: "commit",
    provider: "github",
    label: "Criar ou modificar arquivo",
    grant: "write",
    fields: [
      field("branch", "Branch jk/ autorizada"),
      field("baseSha", "SHA atual da branch"),
      field("path", "Caminho do arquivo"),
      field("content", "Novo conteúdo completo", "textarea"),
      field("message", "Mensagem do commit"),
    ],
  },
  {
    id: "pull",
    provider: "github",
    label: "Abrir pull request para revisão",
    grant: "write",
    fields: [
      field("branch", "Branch jk/ autorizada"),
      field("base", "Branch de destino"),
      field("title", "Título"),
      field("body", "Descrição", "textarea"),
    ],
  },
  {
    id: "schemas",
    provider: "supabase",
    label: "Consultar schemas e tabelas",
    grant: "read",
    fields: [],
  },
  {
    id: "select",
    provider: "supabase",
    label: "Consultar dados em somente leitura",
    grant: "read",
    fields: [
      field("table", "Tabela do schema public"),
      field("columns", "Colunas separadas por vírgula", "text", "id,nome"),
      field("limit", "Limite de linhas", "number", "20"),
    ],
  },
  {
    id: "diagnostics",
    provider: "supabase",
    label: "Consultar diagnósticos de segurança",
    grant: "read",
    fields: [],
  },
  {
    id: "logs",
    provider: "supabase",
    label: "Consultar logs recentes",
    grant: "read",
    fields: [],
  },
  {
    id: "create_table",
    provider: "supabase",
    label: "Criar tabela por migração aprovada",
    grant: "write",
    fields: [
      field("table", "Nome da nova tabela"),
      field(
        "columns",
        "Colunas: nome:tipo, uma por linha",
        "textarea",
        "id:uuid\ntitulo:text\nativo:boolean",
      ),
    ],
  },
  {
    id: "insert",
    provider: "supabase",
    label: "Inserir uma linha",
    grant: "write",
    fields: [
      field("table", "Tabela"),
      field(
        "values",
        "Valores JSON da linha",
        "textarea",
        '{"id":"exemplo","titulo":"Rascunho"}',
      ),
    ],
  },
  {
    id: "update",
    provider: "supabase",
    label: "Atualizar linha pelo id",
    grant: "write",
    fields: [
      field("table", "Tabela"),
      field("id", "id da linha"),
      field("values", "Alterações JSON", "textarea"),
    ],
  },
  {
    id: "delete",
    provider: "supabase",
    label: "Excluir linha pelo id",
    grant: "write",
    fields: [field("table", "Tabela"), field("id", "id da linha")],
  },
  {
    id: "project",
    provider: "vercel",
    label: "Consultar projeto",
    grant: "read",
    fields: [],
  },
  {
    id: "deployments",
    provider: "vercel",
    label: "Listar deployments",
    grant: "read",
    fields: [],
  },
  {
    id: "build_logs",
    provider: "vercel",
    label: "Ler logs de build",
    grant: "read",
    fields: [field("deployment", "Identificador do deployment")],
  },
  {
    id: "runtime_logs",
    provider: "vercel",
    label: "Ler erros de execução",
    grant: "read",
    fields: [field("deployment", "Identificador do deployment")],
  },
  {
    id: "preview",
    provider: "vercel",
    label: "Preparar deployment Preview",
    grant: "deploy",
    fields: [
      field("repoId", "ID do repositório GitHub", "number"),
      field("branch", "Branch jk/"),
      field("sha", "SHA exato para o Preview"),
    ],
  },
  {
    id: "preview_env",
    provider: "vercel",
    label: "Criar variável de uma branch Preview",
    grant: "configure",
    fields: [
      field("branch", "Branch jk/"),
      field("key", "Nome da variável"),
      field("value", "Valor", "textarea"),
    ],
  },
];
export function operation(provider: Provider, id: string) {
  return OPERATIONS.find((x) => x.provider === provider && x.id === id);
}
