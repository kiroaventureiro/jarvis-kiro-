param(
 [Parameter(Mandatory=$true)][string]$JarvisUrl,
 [Parameter(Mandatory=$true)][string]$BridgeSecret,
 [Parameter(Mandatory=$true)][string]$N8nApiKey,
 [int]$IntervalSeconds = 15
)
$ErrorActionPreference = "Stop"
$base = $JarvisUrl.TrimEnd("/")
if (-not $base.StartsWith("https://")) { throw "O Jarvis precisa de HTTPS." }
if ($BridgeSecret.Length -lt 40) { throw "Segredo da ponte deve ter ao menos 40 caracteres." }
$headers = @{ Authorization = "Bearer $BridgeSecret" }
$n8nHeaders = @{ "X-N8N-API-KEY" = $N8nApiKey }
Write-Host "Jarvis n8n bridge: polling iniciado. Nenhuma porta local sera publicada."
while ($true) {
 try {
  $response = Invoke-RestMethod -Uri "$base/api/director/n8n-bridge" -Method Get -Headers $headers -TimeoutSec 20
  if ($null -ne $response.job) {
   $job = $response.job
   $ok = $false
   $summary = "Workflow nao reconhecido."
   try {
    switch ([string]$job.workflow) {
     "project_report" {
      $data = Invoke-RestMethod -Uri "http://127.0.0.1:5678/api/v1/workflows?limit=100" -Headers $n8nHeaders -TimeoutSec 15
      $count = @($data.data).Count
      $active = @($data.data | Where-Object { $_.active -eq $true }).Count
      $summary = "n8n: $count workflows consultados; $active ativos nesta pagina."
      $ok = $true
     }
     "broadcast_health" { $summary = "Diagnostico OBS requer workflow local explicitamente conectado."; $ok = $false }
     "social_performance" { $summary = "Dados sociais requerem workflows locais autorizados."; $ok = $false }
     "daily_briefing" { $summary = "Boletim requer workflows locais autorizados."; $ok = $false }
     default { $summary = "Operacao nao autorizada pelo worker."; $ok = $false }
    }
   } catch { $summary = "Erro ao executar operacao autorizada: $($_.Exception.GetType().Name)" }
   $body = @{ id=[string]$job.id; ok=$ok; result=$summary } | ConvertTo-Json -Compress
   Invoke-RestMethod -Uri "$base/api/director/n8n-bridge" -Method Post -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 20 | Out-Null
   Write-Host "Tarefa $($job.id): $summary"
  }
 } catch { Write-Warning "Ponte indisponivel: $($_.Exception.GetType().Name)" }
 Start-Sleep -Seconds ([Math]::Max(5,$IntervalSeconds))
}
