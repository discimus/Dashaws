#!/usr/bin/env bash
set -eu
if command -v bash >/dev/null 2>&1 && [ -n "$BASH_VERSION" ]; then set -o pipefail; fi

usage() {
    echo "Usage: ./start-server.sh <python|node> [port]"
    echo ""
    echo "Options:"
    echo "  python    Start the Python server (FastAPI)"
    echo "  node      Start the Node.js server (Express + tsx)"
    echo "  port      Server port (default: 3456)"
    echo ""
    echo "Examples:"
    echo "  ./start-server.sh python"
    echo "  ./start-server.sh node 4000"
}

# --- Helpers ---

check_frontend_build() {
    if [ -f "dist/index.html" ]; then
        return 0
    fi
    echo "[preflight] Frontend not built (dist/ missing). Building..."
    if [ ! -d "node_modules" ]; then
        echo "[preflight] Installing npm dependencies first..."
        npm install
    fi
    npm run build:all
    echo "[preflight] Frontend build complete."
}

check_python_deps() {
    # Verify key dependency groups — if any fails, run full pip install
    if python3 -c "
import fastapi, uvicorn, apscheduler
from Crypto.Cipher import AES
import requests, feedparser, bs4, dotenv, xmltodict, pypdf
import pandas, numpy, lxml, yaml, openpyxl, matplotlib
import sqlalchemy, psycopg2, pytest
" 2>/dev/null; then
        echo "[preflight] Python dependencies OK."
        return 0
    fi
    echo "[preflight] Python dependencies missing or incomplete. Installing..."
    pip3 install -r python-server/requirements.txt
    echo "[preflight] Python dependencies installed."
}

check_node_deps() {
    if [ -d "node_modules" ]; then
        return 0
    fi
    echo "[preflight] Node modules not installed. Installing..."
    npm install
    echo "[preflight] Node modules installed."
}

# --- Main ---

RUNTIME="${1:-}"
PORT="${2:-${PORT:-3456}}"

if [ -z "$RUNTIME" ]; then
    usage
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/script-dashboard"
cd "$PROJECT_DIR"

export PORT

case "$RUNTIME" in
    python)
        echo "=== Dashaws Python Server ==="
        echo "Port: $PORT"
        echo "Data: ${DASHAWS_DATA_DIR:-data-python}"
        echo ""
        if [ ! -d "python-server" ]; then
            echo "ERROR: python-server/ directory not found."
            exit 1
        fi
        check_python_deps
        check_frontend_build
        echo ""
        exec python3 python-server/main.py
        ;;
    node)
        echo "=== Dashaws Node.js Server ==="
        echo "Port: $PORT"
        echo "Data: ${DASHAWS_DATA_DIR:-data-nodejs}"
        echo ""
        check_node_deps
        check_frontend_build
        echo ""
        exec npx tsx server/index.ts
        ;;
    *)
        echo "ERROR: Unknown runtime '$RUNTIME'. Use 'python' or 'node'."
        usage
        exit 1
        ;;
esac
