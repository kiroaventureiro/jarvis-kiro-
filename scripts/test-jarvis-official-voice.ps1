# Teste local isolado do perfil oficial do Jarvis Kiro.
# Executar no PowerShell do Windows, com VoiceStudio aberto.
# Nao publica porta, nao altera perfis nem configura voz do Jarvis.
param(
  [string]$Text = "Jarvis Kiro conectado. Estou pronto para ajudar.",
  [string]$Output = "$env:TEMP\jarvis-kiro-voz-oficial.wav"
)
$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:3900"
$profileId = "af5bbbba"
if ($Text.Length -lt 1 -or $Text.Length -gt 350) { throw "O texto deve ter entre 1 e 350 caracteres." }
$health = Invoke-RestMethod -Uri "$base/health" -TimeoutSec 8
$profiles = @(Invoke-RestMethod -Uri "$base/profiles")
$found = $profiles | Where-Object { $_.id -eq $profileId }
if (-not $found) { throw "Perfil Jarvis Kiro Oficial nao encontrado. Nenhuma sintese foi solicitada." }
$payload = @{model="omnivoice";input=$Text;voice=$profileId;response_format="wav";language="pt";speed=1} | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$watch = [System.Diagnostics.Stopwatch]::StartNew()
try {
  Invoke-WebRequest -Uri "$base/v1/audio/speech" -Method Post -ContentType "application/json; charset=utf-8" -Body $bytes -OutFile $Output -TimeoutSec 650 -UseBasicParsing
} finally { $watch.Stop() }
$stream = [System.IO.File]::OpenRead($Output)
try {
  $header = New-Object byte[] 12
  if ($stream.Read($header,0,12) -ne 12 -or
    [System.Text.Encoding]::ASCII.GetString($header,0,4) -ne "RIFF" -or
    [System.Text.Encoding]::ASCII.GetString($header,8,4) -ne "WAVE") {
    Remove-Item -LiteralPath $Output -Force -ErrorAction SilentlyContinue
    throw "O servidor nao retornou um arquivo WAV valido."
  }
} finally { $stream.Dispose() }
Write-Host "Voz oficial sintetizada. Tempo de resposta: $([math]::Round($watch.Elapsed.TotalSeconds,1)) segundos"
Write-Host "Arquivo: $Output"
Write-Host "A voz do Jarvis no navegador nao foi alterada."
