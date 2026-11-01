# Jarvis Kiro - Windows Task Scheduler runner and installer.
# Usage: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-voice-worker-task.ps1
# Installs for the CURRENT Windows user only. Does not require admin rights.
[CmdletBinding()]
param(
    [switch]$Run,
    [string]$VoiceUrl = $env:JARVIS_VOICE_WORKER_URL
)
$ErrorActionPreference = "Stop"
$project = Split-Path -Parent $PSScriptRoot
$worker = Join-Path $PSScriptRoot "voice-worker-cloud.mjs"
$homeDir = Join-Path $env:USERPROFILE ".jarvis-kiro"
$secretFile = Join-Path $homeDir "vercel-worker-bypass.dpapi"
$urlFile = Join-Path $homeDir "voice-worker-url.txt"
$logFile = Join-Path $homeDir "voice-worker-task.log"
$taskName = "Jarvis Kiro - Voice Worker"
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

if (!(Test-Path -LiteralPath $worker)) { throw "VOICE_WORKER_SCRIPT_NOT_FOUND" }
if (!(Test-Path -LiteralPath (Join-Path $homeDir "worker-device.json"))) {
    throw "VOICE_WORKER_NOT_PAIRED: pair this device before scheduling"
}
New-Item -ItemType Directory -Path $homeDir -Force | Out-Null

if ($Run) {
    $mutex = New-Object System.Threading.Mutex($false, "Local\JarvisKiroVoiceWorker")
    $lock = $false
    try {
        try { $lock = $mutex.WaitOne(0) }
        catch [System.Threading.AbandonedMutexException] { $lock = $true }
        if (!$lock) { exit 0 } # Never run two workers concurrently.
        if (!(Test-Path -LiteralPath $urlFile)) { throw "VOICE_WORKER_URL_NOT_CONFIGURED" }
        $VoiceUrl = (Get-Content -LiteralPath $urlFile -Raw).Trim()
        if ($VoiceUrl -notmatch '^https://') { throw "VOICE_WORKER_URL_MUST_BE_HTTPS" }
        $env:JARVIS_VOICE_WORKER_URL = $VoiceUrl
        if (Test-Path -LiteralPath $secretFile) {
            $secure = Get-Content -LiteralPath $secretFile -Raw | ConvertTo-SecureString
            $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
            try { $env:JARVIS_VERCEL_PROTECTION_BYPASS = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
            finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
        }
        Set-Location -LiteralPath $project
        while ($true) {
            try {
                & $nodeExe $worker run *>> $logFile
                $exitCode = $LASTEXITCODE
                Add-Content -LiteralPath $logFile -Value ("Worker exited with code " + $exitCode + " at " + (Get-Date).ToString("o"))
            } catch {
                Add-Content -LiteralPath $logFile -Value ("Worker runtime error: " + $_.Exception.GetType().Name)
            }
            Start-Sleep -Seconds 5
        }
    } finally {
        if ($lock) { $mutex.ReleaseMutex() }
        $mutex.Dispose()
    }
}

if (!$VoiceUrl -and (Test-Path -LiteralPath $urlFile)) {
    $VoiceUrl = (Get-Content -LiteralPath $urlFile -Raw).Trim()
}
if ($VoiceUrl -notmatch '^https://[^\s]+$') {
    throw "Set JARVIS_VOICE_WORKER_URL in this PowerShell session or pass -VoiceUrl https://your-current-vercel-preview"
}
Set-Content -LiteralPath $urlFile -Value $VoiceUrl -Encoding ASCII
if (!(Test-Path -LiteralPath $secretFile)) {
    $secret = Read-Host "Vercel protection bypass secret (never paste into chat)" -AsSecureString
    if ($secret.Length -gt 0) {
        # DPAPI encrypts this value for the current Windows user.
        $secret | ConvertFrom-SecureString | Set-Content -LiteralPath $secretFile -Encoding ASCII
    }
}
$script = $MyInvocation.MyCommand.Path
$arguments = '-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '" -Run'
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Installed: $taskName"
Write-Host "Worker will start on Windows sign-in. Logs: $logFile"
Write-Host "To start now, stop any existing foreground worker first, then run:"
Write-Host "Start-ScheduledTask -TaskName '$taskName'"
