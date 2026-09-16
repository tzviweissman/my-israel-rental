# The monthly restore drill, unattended.
#
# WHY A WRAPPER. scripts/restore_drill.py restores production's backup into a
# LOCAL MongoDB, and on this machine mongod is not a service - it is started by
# hand when someone is working. A scheduled run at 3am would otherwise fail with
# "connection refused" and look like a backup problem when it is not.
#
# So this starts mongod if it is not already up, runs the drill, and stops mongod
# again only if it started it. Output goes to a log per run, plus a one-line
# last-result file that is quick to read.
#
# Registered as a Windows scheduled task (Start-when-available, so a laptop that
# was shut at 3am runs it when it next wakes). Run it by hand any time:
#
#   powershell -ExecutionPolicy Bypass -File backend\scripts\restore_drill_monthly.ps1

$ErrorActionPreference = 'Continue'

$backend  = Split-Path -Parent $PSScriptRoot
$python   = Join-Path $backend '.venv\Scripts\python.exe'
$drill    = Join-Path $PSScriptRoot 'restore_drill.py'
$mongod   = 'C:\Users\tzviw\mongodb-local\mongodb-win32-x86_64-windows-8.3.4\bin\mongod.exe'
$dbpath   = 'C:\Users\tzviw\mongodb-local\data'

# Outside the repo: these are run records, not source.
$logDir   = Join-Path $env:LOCALAPPDATA 'MyIsraelRental\restore-drill'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp    = Get-Date -Format 'yyyyMMdd-HHmmss'
$log      = Join-Path $logDir "drill-$stamp.log"

function Write-Log([string]$text) {
    $text | Tee-Object -FilePath $log -Append | Write-Output
}

Write-Log "=== restore drill $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="

foreach ($p in @($python, $drill, $mongod)) {
    if (-not (Test-Path $p)) {
        Write-Log "STOP: missing $p"
        "FAIL $(Get-Date -Format 'yyyy-MM-dd HH:mm') - missing $p" | Set-Content (Join-Path $logDir 'last-result.txt')
        exit 2
    }
}

$mongoWasUp = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue
$started = $null
if (-not $mongoWasUp) {
    Write-Log 'local MongoDB is not running; starting it for this drill'
    $started = Start-Process -FilePath $mongod `
        -ArgumentList @('--dbpath', $dbpath, '--port', '27017', '--bind_ip', '127.0.0.1') `
        -WindowStyle Hidden -PassThru
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        if (Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet -WarningAction SilentlyContinue) { break }
    }
}

try {
    & $python $drill 2>&1 | Tee-Object -FilePath $log -Append
    $code = $LASTEXITCODE
} finally {
    # Only ever stop what this script started; a mongod someone is using stays up.
    if ($started -and -not $started.HasExited) {
        Write-Log 'stopping the MongoDB this drill started'
        Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue
    }
}

$verdict = if ($code -eq 0) { 'PASS' } else { "FAIL (exit $code)" }
Write-Log "=== $verdict ==="
"$verdict $(Get-Date -Format 'yyyy-MM-dd HH:mm') - see $log" | Set-Content (Join-Path $logDir 'last-result.txt')

# A year of monthly runs is plenty of history for a check that takes 15 seconds.
Get-ChildItem $logDir -Filter 'drill-*.log' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 12 |
    Remove-Item -Force -ErrorAction SilentlyContinue

exit $code
