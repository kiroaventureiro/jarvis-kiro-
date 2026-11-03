param(
 [Parameter(Mandatory=$true)][string]$JarvisUrl,
 [Parameter(Mandatory=$true)][string]$BridgeSecret,
 [Parameter(Mandatory=$true)][string]$N8nApiKey,
 [int]$IntervalSeconds = 15,
 [string]$VercelBypass = $env:JARVIS_VERCEL_BYPASS
)
$ErrorActionPreference = "Stop"
$base = $JarvisUrl.TrimEnd("/")
if (-not $base.StartsWith("https://")) { throw "O Jarvis exige HTTPS." }
if ($BridgeSecret.Length -lt 40) { throw "Segredo da ponte inválido." }
$headers = @{ Authorization = "Bearer $BridgeSecret" }
if ($VercelBypass) { $headers["x-vercel-protection-bypass"] = $VercelBypass }
$n8nHeaders = @{ "X-N8N-API-KEY" = $N8nApiKey }
$n8nApi = "http://127.0.0.1:5678/api/v1"
$webhook = "http://127.0.0.1:5678/webhook/jarvis-kiro-approved-github-v1"

# A workflow running in the local n8n makes the HTTPS callback to Jarvis.
# The workflow stores neither GitHub credentials nor the bridge secret.
# The job ticket is minted server-side, single-use and scoped to an approved plan.
$definition = @'
{
  "name":"Jarvis Kiro - GitHub aprovado (ponte v1)",
  "nodes":[
    {
      "id":"862b5e0c-3c96-4897-91db-91cb5dca9901",
      "name":"Receber tarefa Jarvis",
      "type":"n8n-nodes-base.webhook",
      "typeVersion":2,
      "position":[240,300],
      "webhookId":"54b80ab6-a1a3-4c2a-b0fb-a1cdf7f2d844",
      "parameters":{"httpMethod":"POST","path":"jarvis-kiro-approved-github-v1","responseMode":"lastNode","options":{}}
    },
    {
      "id":"bc833cbc-2817-42d7-bad1-fd440b203f6f",
      "name":"Executar plano GitHub aprovado",
      "type":"n8n-nodes-base.httpRequest",
      "typeVersion":4.2,
      "position":[510,300],
      "parameters":{
        "method":"POST",
        "url":"__JARVIS_URL__/api/director/n8n-bridge/execute",
        "sendHeaders":true,
        "headerParameters":{"parameters":[
          {"name":"Content-Type","value":"application/json"},
          {"name":"x-vercel-protection-bypass","value":"={{ $json.body.vercelBypass }}"}
        ]},
        "sendBody":true,
        "specifyBody":"json",
        "jsonBody":"={{ JSON.stringify({jobId:$json.body.jobId,planId:$json.body.planId,digest:$json.body.digest,ticket:$json.body.ticket}) }}",
        "options":{"timeout":100000}
      }
    }
  ],
  "connections":{"Receber tarefa Jarvis":{"main":[[{"node":"Executar plano GitHub aprovado","type":"main","index":0}]]}},
  "settings":{"executionOrder":"v1","saveDataSuccessExecution":"none","saveDataErrorExecution":"none","saveManualExecutions":false}
}
'@
$definition = $definition.Replace("__JARVIS_URL__", $base)
$workflowName = "Jarvis Kiro - GitHub aprovado (ponte v1)"
function Ensure-JarvisWorkflow {
 $list = Invoke-RestMethod -Uri "$n8nApi/workflows?limit=100" -Headers $n8nHeaders -TimeoutSec 20
 $existing = @($list.data | Where-Object { $_.name -eq $workflowName })
 if ($existing.Count -gt 1) { throw "Workflows Jarvis duplicados: confirme qual está ativo." }
 if ($existing.Count -eq 1) {
  $item = $existing[0]
  $workflowId = [string]$item.id
  $details = Invoke-RestMethod -Uri "$n8nApi/workflows/$workflowId" -Headers $n8nHeaders -TimeoutSec 20
  $node = @($details.nodes | Where-Object { $_.name -eq "Executar plano GitHub aprovado" })[0]
  if (-not $node -or [string]$node.type -ne "n8n-nodes-base.httpRequest" -or @($details.nodes).Count -ne 2) {
   throw "O workflow local foi modificado fora da ponte Jarvis. Não sobrescrevi."
  }
  if ([string]$node.parameters.url -ne "$base/api/director/n8n-bridge/execute") {
   if ($item.active) { Invoke-RestMethod -Uri "$n8nApi/workflows/$workflowId/deactivate" -Method Post -Headers $n8nHeaders -ContentType "application/json" -Body '{}' -TimeoutSec 20 | Out-Null }
   Invoke-RestMethod -Uri "$n8nApi/workflows/$workflowId" -Method Put -Headers $n8nHeaders -ContentType "application/json" -Body $definition -TimeoutSec 30 | Out-Null
   $item.active = $false
  }
 } else {
  $created = Invoke-RestMethod -Uri "$n8nApi/workflows" -Method Post -Headers $n8nHeaders -Body $definition -ContentType "application/json" -TimeoutSec 30
  $workflowId = [string]$created.id
  if (-not $workflowId) { throw "n8n não confirmou o novo workflow." }
 }
 try { Invoke-RestMethod -Uri "$n8nApi/workflows/$workflowId/publish" -Method Post -Headers $n8nHeaders -ContentType "application/json" -Body '{}' -TimeoutSec 20 | Out-Null } catch { Write-Host "n8n: publicação por API não suportada nesta versão; tentando ativar." }
 if ($existing.Count -eq 0 -or -not $item.active) {
  Invoke-RestMethod -Uri "$n8nApi/workflows/$workflowId/activate" -Method Post -Headers $n8nHeaders -ContentType "application/json" -Body '{}' -TimeoutSec 20 | Out-Null
 }
 Write-Host "n8n GitHub: workflow $workflowId criado/ativado para execuções aprovadas."
}
Ensure-JarvisWorkflow
Write-Host "Jarvis n8n bridge: polling iniciado, sem publicar portas locais."
while ($true) {
 try {
  $response = Invoke-RestMethod -Uri "$base/api/director/n8n-bridge" -Method Get -Headers $headers -TimeoutSec 25
  if ($null -ne $response.job) {
   $job = $response.job
   $ok = $false
   $summary = "Workflow não reconhecido."
   if ([string]$job.workflow -eq "github_plan_execute") {
    try {
     if ([string]$job.ticket -notmatch '^[a-f0-9]{64}$') { throw "Ticket inválido." }
     $payload = @{
      jobId=[string]$job.id
      planId=[string]$job.payload.planId
      digest=[string]$job.payload.digest
      ticket=[string]$job.ticket
      vercelBypass=[string]$VercelBypass
     } | ConvertTo-Json -Compress
     $result = Invoke-RestMethod -Uri $webhook -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 120
     if ($result -is [array]) { $result = $result[0] }
     if ($result.ok -eq $true -and [string]$result.prUrl -match '^https://github.com/') {
      Write-Host "GitHub confirmado via n8n: $($result.prUrl)"
     } else {
      Write-Warning "GitHub via n8n: execução não confirmada. Consultar status no Jarvis."
     }
    } catch {
     Write-Warning "GitHub via n8n falhou antes de confirmação; verifique status antes de repetir."
     $failBody = @{id=[string]$job.id;ok=$false;result="Falha no encaminhamento local n8n. Verifique a execução e o GitHub antes de repetir."} | ConvertTo-Json -Compress
     try { Invoke-RestMethod -Uri "$base/api/director/n8n-bridge" -Method Post -Headers $headers -ContentType "application/json" -Body $failBody -TimeoutSec 20 | Out-Null } catch {}
    }
    continue
   }
   try {
    switch ([string]$job.workflow) {
     "project_report" {
      $data = Invoke-RestMethod -Uri "$n8nApi/workflows?limit=100" -Headers $n8nHeaders -TimeoutSec 15
      $count = @($data.data).Count
      $active = @($data.data | Where-Object { $_.active -eq $true }).Count
      $summary = "n8n: $count workflows consultados; $active ativos nesta página."
      $ok = $true
     }
     "broadcast_health" { $summary = "Diagnóstico OBS requer workflow local explicitamente conectado." }
     "social_performance" { $summary = "Dados sociais requerem workflows locais autorizados." }
     "daily_briefing" { $summary = "Boletim requer workflows locais autorizados." }
     default { $summary = "Operação não autorizada pelo worker." }
    }
   } catch { $summary = "Falha na operação de leitura do n8n." }
   $body = @{id=[string]$job.id;ok=$ok;result=$summary} | ConvertTo-Json -Compress
   Invoke-RestMethod -Uri "$base/api/director/n8n-bridge" -Method Post -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 20 | Out-Null
   Write-Host "Tarefa $($job.id): $summary"
  }
 } catch { Write-Warning "Ponte indisponível; conferir URL, proteção Vercel e conexão local n8n." }
 Start-Sleep -Seconds ([Math]::Max(5,$IntervalSeconds))
}
