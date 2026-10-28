# Diagnóstico local do VoiceStudio para o Jarvis Kiro.
# Somente leitura. Não instala, não grava áudio, não acessa microfone, não envia credenciais.
param([int]$Port = 3900)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1 -or $Port -gt 65535) { throw "Porta inválida." }
$base = "http://127.0.0.1:$Port"
function Check-Endpoint([string]$path) {
  try {
    return Invoke-RestMethod -Uri ($base + $path) -Method Get -TimeoutSec 6 -ErrorAction Stop
  } catch {
    return $null
  }
}
Write-Host "VoiceStudio — diagnóstico local JK (somente leitura)"
Write-Host "Verificando loopback $base"
$api = Check-Endpoint '/.well-known/voicestudio-speech'
if ($null -eq $api) {
  Write-Host "ESTADO: backend indisponível. App ou vozes instalados não garantem que API Python esteja iniciada."
  Write-Host "AÇÃO: abra VoiceStudio e confira status do ambiente/servidor antes de repetir."
  exit 2
}
if ($api.protocol -ne 'voicestudio.speech.v1' -or $api.service -ne 'VoiceStudio') {
  Write-Host "ESTADO: servidor respondeu, mas não confirmou protocolo VoiceStudio."
  exit 3
}
$voices = Check-Endpoint '/v1/audio/voices'
if ($null -eq $voices -or $null -eq $voices.voices) {
  Write-Host "ESTADO: descoberta ativa, catálogo de vozes não pôde ser confirmado."
  exit 4
}
$profiles = @($voices.voices | Where-Object { $_.type -eq 'profile' }).Count
Write-Host "ESTADO: API de descoberta ativa (somente leitura)."
Write-Host "Perfis salvos: $profiles"
Write-Host "Transcrição anunciada: $($api.features.batch_transcription -eq $true)"
Write-Host "PENDENTE: teste de áudio real em pt-BR e validação de licença no aplicativo."
Write-Host "ATENÇÃO: isso ainda não conecta o PC à Vercel; a porta local não deve ser exposta à internet."
exit 0
