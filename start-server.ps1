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

function Check-FrontendBuild {
    if (Test-Path -LiteralPath (Join-Path $projectDir "dist\index.html")) {
        return
    }
    Write-Host "[preflight] Frontend not built (dist/ missing). Building..."
    Set-Location $projectDir
    if (-not (Test-Path -LiteralPath (Join-Path $projectDir "node_modules"))) {
        Write-Host "[preflight] Installing npm dependencies first..."
        npm install
        if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
    }
    npm run build:all
    if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed"; exit 1 }
    Write-Host "[preflight] Frontend build complete."
}

function Check-PythonDeps {
    Set-Location $projectDir
    $check = @"
import fastapi, uvicorn, apscheduler
from Crypto.Cipher import AES
import requests, feedparser, bs4, dotenv, xmltodict, pypdf
import pandas, numpy, lxml, yaml, openpyxl, matplotlib
import sqlalchemy, psycopg2, pytest
"@
    $result = python3 -c $check 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[preflight] Python dependencies OK."
        return
    }
    Write-Host "[preflight] Python dependencies missing or incomplete. Installing..."
    pip3 install -r python-server/requirements.txt
    if ($LASTEXITCODE -ne 0) { Write-Error "pip install failed"; exit 1 }
    Write-Host "[preflight] Python dependencies installed."
}

function Check-NodeDeps {
    Set-Location $projectDir
    if (Test-Path -LiteralPath (Join-Path $projectDir "node_modules")) {
        return
    }
    Write-Host "[preflight] Node modules not installed. Installing..."
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
    Write-Host "[preflight] Node modules installed."
}

function Check-AuthConfig {
    $configPath = Join-Path $scriptDir "dashaws.config.json"
    if (Test-Path -LiteralPath $configPath) {
        try {
            $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
            if ($config.password -and $config.password -ne "change-me") {
                Write-Host "[auth] Config file found with custom password."
                return
            }
            elseif ($config.password -eq "change-me") {
                Write-Host "[auth] WARNING: Using default password 'change-me'. Change it in dashaws.config.json!"
                return
            }
        } catch {
            Write-Host "[auth] WARNING: Config file is invalid JSON. Server will start WITHOUT authentication."
            return
        }
    }

    Write-Host ""
    Write-Host "[auth] No dashaws.config.json found."
    Write-Host "[auth] Set a server password now (leave empty to skip authentication):"
    Write-Host ""
    $securePw = Read-Host -Prompt "Password" -AsSecureString
    $plainPw = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePw)
    )

    if ([string]::IsNullOrWhiteSpace($plainPw)) {
        Write-Host "[auth] No password provided. Server will start WITHOUT authentication."
        return
    }

    $secureConfirm = Read-Host -Prompt "Confirm password" -AsSecureString
    $plainConfirm = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureConfirm)
    )

    if ($plainPw -ne $plainConfirm) {
        Write-Host "[auth] Passwords do not match. Server will start WITHOUT authentication."
        return
    }

    $config = @{ password = $plainPw } | ConvertTo-Json
    Set-Content -LiteralPath $configPath -Value $config -Encoding UTF8
    Write-Host "[auth] Config file created with your password."
}

# --- Main ---

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
        Check-AuthConfig
        Set-Location $projectDir
        $pythonServerDir = Join-Path $projectDir "python-server"
        if (-not (Test-Path $pythonServerDir)) {
            Write-Error "python-server/ directory not found."
            exit 1
        }
        Check-PythonDeps
        Check-FrontendBuild
        Write-Host ""
        python3 "$pythonServerDir\main.py"
    }
    "node" {
        Write-Host "=== Dashaws Node.js Server ==="
        Write-Host "Port: $envPort"
        Write-Host "Data: $env:DASHAWS_DATA_DIR"
        Write-Host ""
        Check-AuthConfig
        Set-Location $projectDir
        Check-NodeDeps
        Check-FrontendBuild
        Write-Host ""
        npx tsx server/index.ts
    }
}
