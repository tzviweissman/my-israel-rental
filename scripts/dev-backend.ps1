<#
    Start the local API server, bringing MongoDB up first if it isn't
    already running.

    WHY THIS EXISTS
    ---------------
    MongoDB doesn't start with Windows, and the app fails in a way that
    points nowhere near the real cause: with no database, the backend
    hangs partway through startup and never serves a request, so the
    signup page's fetch fails outright. The page has no message for
    "couldn't reach the server", so it falls back to its generic wording
    and says "Authentication failed" — which reads as a rejected
    password. That cost a debugging session on 12 Aug 2026.

    This wrapper removes the failure mode rather than the symptom:
    starting the backend now guarantees a database is there.

    SAFE TO RUN ANY TIME. It never starts a second mongod, and it will
    not touch a local database when the app is pointed at a remote one.

    Wired up as the "backend" entry in .claude/launch.json.
#>
$ErrorActionPreference = 'Stop'

$Repo    = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Repo 'backend'
$Port    = 27017

function Test-MongoUp {
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $Port)
        $c.Close()
        return $true
    } catch { return $false }
}

function Get-MongoUrl {
    # Read MONGO_URL from backend/.env without printing it. Only the
    # host shape matters here, never the credentials.
    $envFile = Join-Path $Backend '.env'
    if (-not (Test-Path $envFile)) { return '' }
    $line = Select-String -Path $envFile -Pattern '^MONGO_URL=' -ErrorAction SilentlyContinue |
            Select-Object -First 1
    if (-not $line) { return '' }
    return $line.Line.Substring('MONGO_URL='.Length).Trim().Trim('"').Trim("'")
}

function Find-Mongod {
    # An explicit override wins, so a different install can be used
    # without editing this file.
    if ($env:MONGOD_EXE -and (Test-Path $env:MONGOD_EXE)) { return $env:MONGOD_EXE }
    # Otherwise take the newest versioned folder, so a MongoDB upgrade
    # doesn't silently keep launching the old binary.
    $found = Get-ChildItem -Path (Join-Path $env:USERPROFILE 'mongodb-local') `
                           -Filter 'mongod.exe' -Recurse -ErrorAction SilentlyContinue |
             Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
    return $null
}

# --- Bring up MongoDB, unless it isn't ours to bring up ---------------

$mongoUrl = Get-MongoUrl

if ($mongoUrl -and $mongoUrl -notmatch 'localhost|127\.0\.0\.1') {
    # Pointed at Atlas or another remote host. Starting a local mongod
    # here would be pointless at best and confusing at worst — someone
    # would end up staring at an empty local database wondering where
    # production data went.
    Write-Host '[dev] MONGO_URL is remote - not starting a local MongoDB.'
}
elseif (Test-MongoUp) {
    Write-Host "[dev] MongoDB already running on $Port."
}
else {
    $mongod = Find-Mongod
    if (-not $mongod) {
        # Deliberately a warning, not a hard stop: the backend should
        # still get a chance to start and log its own errors. Someone on
        # a different machine shouldn't be blocked by this wrapper.
        Write-Warning '[dev] mongod.exe not found. Set MONGOD_EXE, or start MongoDB yourself.'
    }
    else {
        $dataDir = Join-Path $env:USERPROFILE 'mongodb-local\data'
        $logDir  = Join-Path $env:USERPROFILE 'mongodb-local\log'
        New-Item -ItemType Directory -Force -Path $dataDir, $logDir | Out-Null

        Write-Host '[dev] Starting MongoDB...'
        # Spawned via WMI rather than Start-Process, and the difference
        # is load-bearing: a Start-Process child is killed along with
        # this script's process tree, so every backend restart would
        # hard-kill the database. That leaves a stale lock and forces a
        # recovery pass on the next boot - exactly the state found on
        # 12 Aug 2026. A WMI-created process is genuinely independent,
        # so the database outlives backend restarts and only ever stops
        # when it is asked to.
        #
        # Logs to a file (no console window in the way) and binds to
        # 127.0.0.1 only - a dev database is never exposed to the network.
        $mongoCmd = '"{0}" --dbpath "{1}" --port {2} --bind_ip 127.0.0.1 --logpath "{3}" --logappend' -f `
            $mongod, $dataDir, $Port, (Join-Path $logDir 'mongod.log')
        $spawn = Invoke-CimMethod -ClassName Win32_Process -MethodName Create `
                                  -Arguments @{ CommandLine = $mongoCmd }
        if ($spawn.ReturnValue -ne 0) {
            Write-Warning "[dev] Could not launch MongoDB (code $($spawn.ReturnValue))."
        }

        # Wait for it to actually accept connections. Starting uvicorn
        # before this point just recreates the hang we're fixing —
        # recovery after an unclean shutdown can take a few seconds.
        $deadline = (Get-Date).AddSeconds(45)
        while (-not (Test-MongoUp)) {
            if ((Get-Date) -gt $deadline) {
                Write-Warning "[dev] MongoDB did not come up within 45s. See $logDir\mongod.log"
                break
            }
            Start-Sleep -Milliseconds 400
        }
        if (Test-MongoUp) { Write-Host '[dev] MongoDB is up.' }
    }
}

# --- Start the API server --------------------------------------------

Write-Host '[dev] Starting the API server on 8001...'
& (Join-Path $Backend '.venv\Scripts\python.exe') `
    -m uvicorn server:app --app-dir $Backend --host 0.0.0.0 --port 8001 --reload
