import registry from "../../config/kiro-project-registry.json";
export type ProjectResource = {
  id: string;
  name: string;
  kiroProject?: string;
};
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/quiro\s*gestao/g, "kiro gestao");
const tokens = (s: string) =>
  normalize(s)
    .match(/[a-z0-9]+/g)
    ?.filter((w) => !["do", "da", "de", "dos", "das", "site"].includes(w)) ||
  [];
const compact = (s: string) => tokens(s).join("");
const projects = [
  ...registry.projects.map((p) => ({
    id: p.id,
    names: [p.id, ...p.name.split("/").map((x) => x.trim())],
  })),
  { id: "jarvis-kiro", names: ["Jarvis Kiro", "JarvisKiro", "JK"] },
];
export type ProjectSelection =
  | { kind: "all" }
  | { kind: "target"; projectId?: string; name: string; keys: string[] }
  | { kind: "unresolved"; reason: string };
export function requestedProject(
  message: string,
  resources: ProjectResource[],
): ProjectSelection {
  const n = normalize(message),
    flat = compact(message);
  const canonical = projects.filter((p) =>
    p.names.some((name) => {
      const k = compact(name);
      return k.length >= 4 && flat.includes(k);
    }),
  );
  if (canonical.length > 1)
    return {
      kind: "unresolved",
      reason:
        "Mais de um projeto foi mencionado. Faça consultas separadas para evitar misturar resultados.",
    };
  if (canonical[0]) {
    const p = canonical[0];
    return {
      kind: "target",
      projectId: p.id,
      name: p.names[0],
      keys: p.names.map(compact),
    };
  }
  const hits = resources.filter((r) => {
    const k = compact(r.name.split("/").at(-1) || r.name);
    return k.length >= 5 && flat.includes(k);
  });
  const unique = [
    ...new Map(
      hits.map((r) => [compact(r.name.split("/").at(-1) || r.name), r]),
    ).values(),
  ];
  if (unique.length === 1) {
    const r = unique[0];
    return {
      kind: "target",
      projectId: r.kiroProject,
      name: r.name,
      keys: [compact(r.name.split("/").at(-1) || r.name)],
    };
  }
  if (unique.length > 1)
    return {
      kind: "unresolved",
      reason:
        "O nome corresponde a mais de um recurso. Informe um projeto por consulta.",
    };
  if (
    /todos|todas|tudo|meus projetos|minhas conexoes|integracoes|plataformas|conexoes/.test(
      n,
    ) &&
    !/especific/.test(n)
  )
    return { kind: "all" };
  return {
    kind: "unresolved",
    reason:
      "Não identifiquei um projeto autorizado com esse nome. Informe o nome ou vínculo exato na Central de Conexões.",
  };
}
export function selectProjectResources(
  selection: ProjectSelection,
  resources: ProjectResource[],
) {
  if (selection.kind === "all") return resources;
  if (selection.kind === "unresolved") return [];
  return resources.filter(
    (r) =>
      (selection.projectId && r.kiroProject === selection.projectId) ||
      selection.keys.includes(compact(r.name.split("/").at(-1) || r.name)),
  );
}
