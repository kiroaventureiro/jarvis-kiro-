import { NextResponse } from "next/server";
import { claimGithubExecution, finishGithubExecution } from "../../../../../lib/n8n/bridge";
import { connectors } from "../../../../../lib/connectors/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let claimed = false;
  let jobId = "";
  try {
    const raw = await request.text();
    if (raw.length > 1300) throw Error("REQUEST_TOO_LARGE");
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("INVALID_REQUEST");
    if (Object.keys(data).some(key => !["jobId", "planId", "digest", "ticket"].includes(key)) ||
        typeof data.jobId !== "string" || typeof data.planId !== "string" ||
        typeof data.digest !== "string" || typeof data.ticket !== "string") throw Error("INVALID_REQUEST");
    jobId = data.jobId;
    const approved = await claimGithubExecution(data.jobId,data.planId,data.digest,data.ticket);
    claimed = true;
    let plan = await connectors.execute(data.planId,data.digest,approved.session);
    // Multi-step plans may voluntarily yield after their per-request time budget.
    if (plan.status === "waiting") plan = await connectors.execute(data.planId,data.digest,approved.session);
    const failed = plan.steps.find(step => step.status === "failed" || step.status === "uncertain");
    const pr = plan.steps.find(step => step.action.operation === "pull")?.result as {url?:string}|undefined;
    const commit = plan.steps.find(step => step.action.operation === "commit")?.result as {sha?:string}|undefined;
    const summary = plan.status === "done" && !failed && pr?.url
      ? "GitHub confirmado: commit " + (commit?.sha || "indisponível") + "; PR " + pr.url
      : "Execução " + plan.status + (failed ? " na etapa " + failed.action.operation + " (" + (failed.error || "sem código") + ")" : "") + ". Não assumir escrita concluída.";
    const ok = plan.status === "done" && !failed && !!pr?.url;
    await finishGithubExecution(jobId,ok,summary);
    return NextResponse.json({ok,state:plan.status,summary,prUrl:ok?pr?.url:null}, {headers});
  } catch {
    if (claimed && jobId) {
      await finishGithubExecution(jobId,false,"Falha ou resultado incerto na execução. Confira os commits e PRs no GitHub antes de repetir.").catch(()=>{});
    }
    return NextResponse.json({ok:false,error:claimed?"GITHUB_EXECUTION_UNCERTAIN":"BRIDGE_DENIED"}, {status:claimed?502:403,headers});
  }
}
