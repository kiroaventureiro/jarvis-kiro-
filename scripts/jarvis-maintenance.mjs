import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const steps = [
  { id: 'dependencies', args: ['audit', '--omit=dev', '--json'], timeout: 60000 },
  { id: 'tests', args: ['test'], timeout: 240000 },
  { id: 'types', args: ['exec', '--no', '--', 'tsc', '--noEmit', '--incremental', 'false'], timeout: 120000 },
];

// Invoke npm's JS entrypoint directly: no shell, npx download or arbitrary commands.
async function runCommand(args, timeout) {
  const npm = process.env.npm_execpath;
  if (!npm || !path.isAbsolute(npm)) throw Error('Execute com npm run maintenance:check.');
  return new Promise(resolve => {
    const child = spawn(process.execPath, [npm, ...args], { cwd: root, timeout, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', bytes = 0, failure;
    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) { failure = 'OUTPUT_LIMIT'; child.kill(); }
      else stdout += chunk.toString();
    });
    child.stderr.resume();
    child.on('error', () => { failure = 'START_FAILED'; });
    child.on('close', (code, signal) => resolve({ code, stdout, failure: failure || (signal ? 'INTERRUPTED_OR_TIMEOUT' : undefined) }));
  });
}

export async function maintenanceCheck(run = runCommand) {
  const checks = [];
  for (const step of steps) {
    const startedAt = new Date().toISOString();
    let result;
    try { result = await run(step.args, step.timeout); }
    catch { result = { code: null, failure: 'START_FAILED' }; }
    const check = { id: step.id, startedAt, finishedAt: new Date().toISOString(), passed: result.code === 0 && !result.failure, exitCode: result.code, ...(result.failure ? { failure: result.failure } : {}) };
    if (step.id === 'dependencies') {
      try {
        const counts = JSON.parse(result.stdout).metadata.vulnerabilities;
        if (!['info', 'low', 'moderate', 'high', 'critical', 'total'].every(key => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) throw Error();
        check.vulnerabilities = Object.fromEntries(["info", "low", "moderate", "high", "critical", "total"].map(key => [key, counts[key]]));
        check.passed = check.passed && counts.total === 0;
      } catch { check.passed = false; check.failure = 'INVALID_AUDIT_RESULT'; }
    }
    checks.push(check);
  }
  return { checkedAt: new Date().toISOString(), healthy: checks.every(check => check.passed), checks, schedulerActive: false, automaticCodeChanges: false, knowledgeUpdates: false, limitation: 'Verificação local desta execução. Não comprova contas, produção, legislação ou desempenho gráfico.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await maintenanceCheck();
  const directory = path.join(tmpdir(), 'jarvis-maintenance');
  await mkdir(directory, { recursive: true });
  const filename = path.join(directory, `report-${Date.now()}-${process.pid}.json`);
  await writeFile(filename, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ ...report, reportFile: filename }, null, 2));
  process.exitCode = report.healthy ? 0 : 1;
}
