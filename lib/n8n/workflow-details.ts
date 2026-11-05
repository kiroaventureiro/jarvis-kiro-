export function requestedWorkflowDetails(message: string, workflows: Array<{id:string;name:string}>) {
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g," ").trim();
  const query = normalize(message);
  if (!/configur|detalh|estrutura|\bnos\b/.test(query) || !/\b(fluxo|workflow)\b/.test(query)) return null;
  const matches = workflows.filter(w => {
    const short = normalize(w.name.split("|").at(-1) || w.name);
    return (" " + query + " ").includes(" " + normalize(w.id) + " ") ||
      (short.length >= 5 && (" " + query + " ").includes(" " + short + " "));
  });
  return matches.length === 1 ? matches[0].id : "select_workflow";
}

/** Public presentation of workflow structure. Node parameters and credentials never leave the server. */
export function summarizeWorkflow(raw: unknown, expectedId: string) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("N8N_WORKFLOW_INVALID");
  const w = raw as Record<string, unknown>;
  if (w.id !== expectedId || typeof w.name !== "string" || !Array.isArray(w.nodes) || w.nodes.length > 1000) {
    throw Error("N8N_WORKFLOW_INVALID");
  }
  const nodes = w.nodes.map((value: unknown) => {
    if (!value || typeof value !== "object") throw Error("N8N_WORKFLOW_INVALID");
    const n = value as Record<string, unknown>;
    if (typeof n.id !== "string" || typeof n.name !== "string" || typeof n.type !== "string") throw Error("N8N_WORKFLOW_INVALID");
    return { id: n.id.slice(0, 100), name: n.name.slice(0, 150), type: n.type.slice(0, 150), disabled: n.disabled === true };
  });
  const settings: Record<string, string | number | boolean> = {};
  const source = w.settings && typeof w.settings === "object" && !Array.isArray(w.settings)
    ? w.settings as Record<string, unknown> : {};
  for (const key of ["executionOrder", "timezone", "saveDataSuccessExecution", "saveDataErrorExecution"])
    if (typeof source[key] === "string") settings[key] = (source[key] as string).slice(0, 100);
  if (typeof source.executionTimeout === "number" && Number.isFinite(source.executionTimeout)) settings.executionTimeout = source.executionTimeout;
  if (typeof source.saveManualExecutions === "boolean") settings.saveManualExecutions = source.saveManualExecutions;
  return { id: expectedId, name: w.name.slice(0, 150), active: w.active === true, nodes, settings,
    checkedAt: new Date().toISOString(), executionEnabled: false,
    note: "Estrutura e configurações permitidas. Parâmetros dos nós, credenciais, dados fixados e resultados de execução omitidos." };
}
