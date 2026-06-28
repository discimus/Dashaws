param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("python", "node")]
    [string]$Runtime = "",

    [Parameter(Mandatory=$false)]
    [int]$Port = 0
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Join-Path $scriptDir "script-dashboard"

function Show-Usage {
    Write-Host "Usage: .\start-server.ps1 -Runtime <python|node> [-Port <port>]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  python    Start the Python server (FastAPI)"
    Write-Host "  node      Start the Node.js server (Express + tsx)"
    Write-Host "  -Port     Server port (default: 3456)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\start-server.ps1 -Runtime python"
    Write-Host "  .\start-server.ps1 -Runtime node -Port 4000"
}

if ($Runtime -eq "") {
    Show-Usage
    exit 1
}

$envPort = if ($Port -gt 0) { [string]$Port } else { $env:PORT ?? "3456" }
$env:PORT = $envPort

switch ($Runtime) {
    "python" {
        Write-Host "=== Dashaws Python Server ==="
        Write-Host "Port: $envPort"
        Write-Host "Data: $env:DASHAWS_DATA_DIR"
        Write-Host ""
        Set-Location $projectDir
        $pythonServerDir = Join-Path $projectDir "python-server"
        if (-not (Test-Path $pythonServerDir)) {
            Write-Error "python-server/ directory not found."
            exit 1
        }
        python3 "$pythonServerDir\main.py"
    }
    "node" {
        Write-Host "=== Dashaws Node.js Server ==="
        Write-Host "Port: $envPort"
        Write-Host "Data: $env:DASHAWS_DATA_DIR"
        Write-Host ""
        Set-Location $projectDir
        npx tsx server/index.ts
    }
}
