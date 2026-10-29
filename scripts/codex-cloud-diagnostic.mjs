import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execute = promisify(execFile);

/** Read-only probe of the installed official CLI. Never exports its raw output,
 * reads credential files, creates tasks, or infers Cloud access from login status.
 */
export async function diagnoseCodexCloud({run = execute, env = process.env} = {}) {
  const report = {
    cliInstalled: false, cliVersion: null, cloudCommandsAvailable: false,
    cloudAuthentication: "not_verified", taskCreationVerified: false,
    jarvisExecutorConnected: false,
    configurationPresent: Object.fromEntries([
      "JARVIS_SESSION_SECRET", "JARVIS_CONNECTOR_STORE_URL",
      "JARVIS_CONNECTOR_STORE_KEY", "JARVIS_CONNECTOR_ENCRYPTION_KEY",
      "JARVIS_CODEX_WORKER_SIGNING_SECRET",
    ].map(name => [name, Boolean(env[name])])),
    blocker: "cli_unavailable",
  };
  const call = args => run("codex", args, {
    timeout: 15_000, maxBuffer: 256 * 1024, encoding: "utf8", shell: false, env,
  });
  try {
    const {stdout} = await call(["--version"]);
    const match = stdout.trim().match(/^codex-cli (\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/);
    if (!match) return {...report, blocker: "unexpected_cli_version"};
    report.cliInstalled = true;
    report.cliVersion = match[1];
  } catch { return report; }
  try {
    const {stdout} = await call(["cloud", "--help"]);
    report.cloudCommandsAvailable = /\bexec\b/.test(stdout) && /\blist\b/.test(stdout) && /\bstatus\b/.test(stdout);
    if (!report.cloudCommandsAvailable) return {...report, blocker: "cloud_commands_unavailable"};
  } catch { return {...report, blocker: "cloud_commands_unavailable"}; }
  try {
    const {stdout} = await call(["cloud", "list", "--json", "--limit", "1"]);
    const data = JSON.parse(stdout);
    if (!Array.isArray(data) && (!data || !Array.isArray(data.tasks)))
      return {...report, blocker: "unexpected_cloud_response"};
    // Successful authenticated read is evidence of read access only.
    return {...report, cloudAuthentication: "read_verified", blocker: "jarvis_adapter_not_connected"};
  } catch (error) {
    // Classify in memory; never print command output, headers or credentials.
    const detail = String(error?.stderr || "") + String(error?.message || "");
    if (/\b401\b|unauthorized|authentication token/i.test(detail))
      return {...report, cloudAuthentication: "rejected", blocker: "cloud_authentication_rejected"};
    if (/\b403\b|forbidden/i.test(detail))
      return {...report, cloudAuthentication: "denied", blocker: "cloud_access_denied"};
    if (error?.killed) return {...report, blocker: "cloud_probe_timeout"};
    // A transport failure says nothing about whether the service accepts login.
    // Keep raw errors private: they may include task data or credentials.
    if (/error sending request|failed to connect|could not connect|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|certificate verify failed/i.test(detail))
      return {...report, blocker: "cloud_transport_failed"};
    return {...report, blocker: "cloud_probe_failed"};
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await diagnoseCodexCloud();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.cloudAuthentication === "read_verified" ? 0 : 1;
}
