param(
 [string]$PreProductionUrl = "https://jarvis-kiro-preproducao.vercel.app",
 [string]$ProductionUrl = "https://jarvis-kiro.vercel.app",
 [switch]$IncludeProduction
)
$ErrorActionPreference = "Stop"
$worker = Join-Path $PSScriptRoot "n8n-bridge-worker.ps1"
if (-not (Test-Path $worker)) { throw "Worker n8n não encontrado." }
if (-not $env:JARVIS_N8N_API_KEY) { throw "Configure JARVIS_N8N_API_KEY no Windows." }
if (-not $env:JARVIS_N8N_BRIDGE_SECRET_PREPRODUCTION -and -not $env:JARVIS_N8N_BRIDGE_SECRET) {
 throw "Configure a credencial privada da ponte de pré-produção."
}
if ($IncludeProduction -and -not $env:JARVIS_N8N_BRIDGE_SECRET_PRODUCTION) {
 throw "Configure a credencial separada da ponte de produção."
}
function Confirm-StableUrl([string]$url,[string]$name) {
 if (-not $url) { throw "Defina o endereço estável de $name. Não use deployments temporários." }
 try { $uri = [Uri]$url } catch { throw "URL inválida para $name." }
 if ($uri.Scheme -ne "https" -or $uri.UserInfo -or $uri.Port -ne 443 -or
     $uri.AbsolutePath -ne "/" -or $uri.Query -or $uri.Fragment) {
  throw "Use somente a origem HTTPS estável, sem caminhos ou parâmetros, para $name."
 }
 # Vercel deployment URLs rotate on new builds; require a project or custom alias.
 if ($uri.Host -match "^jarvis-kiro-[a-z0-9]{7,}-umiversokiro[.]vercel[.]app$") {
  throw "O endereco de $name parece um deployment temporario. Use o dominio estavel do ambiente."
 }
 return $uri.GetLeftPart([UriPartial]::Authority)
}
$pre = Confirm-StableUrl $PreProductionUrl "pré-produção"
if ($IncludeProduction) {
 $prod = Confirm-StableUrl $ProductionUrl "produção"
 if ($pre -eq $prod) { throw "Pré-produção e produção precisam de endereços diferentes." }
}
function Start-JarvisWorker([string]$environment,[string]$url) {
 $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $worker + '" -Environment ' +
   $environment + ' -JarvisUrl "' + $url + '"'
 # No GitHub, n8n or bridge credentials appear in process command lines.
 Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WorkingDirectory $PSScriptRoot
 Write-Host "Worker $environment iniciado para o endereço estável: $url"
}
Start-JarvisWorker "preproduction" $pre
if ($IncludeProduction) { Start-JarvisWorker "production" $prod }
Write-Host "Os workers usam domínios estáveis; não é preciso trocar URLs por commit."
