/**
 * Codex execution capabilities must be reported from verified components,
 * not inferred from a signing secret or a developer's local installation.
 * No remote execution is performed by this module.
 */
export type CodexWorkerReadiness = {
  planner: "available";
  execution: "not_connected";
  workerAuthenticated: false;
  canStartTasks: false;
  canResumeTasks: false;
  prerequisites: {
    authenticatedWorker: false;
    durableQueue: false;
    signedApprovalReceipt: false;
    resultChannel: false;
    isolatedRepositoryCheckout: false;
  };
  nextStep: string;
};
export function codexWorkerReadiness(): CodexWorkerReadiness {
  return {
    planner: "available",
    execution: "not_connected",
    workerAuthenticated: false,
    canStartTasks: false,
    canResumeTasks: false,
    prerequisites: {
      authenticatedWorker: false,
      durableQueue: false,
      signedApprovalReceipt: false,
      resultChannel: false,
      isolatedRepositoryCheckout: false,
    },
    nextStep: "Conectar um worker Codex de execução isolada com autenticação mútua, fila persistente, comprovante de aprovação e canal de resultados. Não usar credenciais do navegador.",
  };
}
