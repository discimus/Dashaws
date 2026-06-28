#!/usr/bin/env bash
set -euo pipefail

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
        exec python3 python-server/main.py
        ;;
    node)
        echo "=== Dashaws Node.js Server ==="
        echo "Port: $PORT"
        echo "Data: ${DASHAWS_DATA_DIR:-data-nodejs}"
        echo ""
        exec npx tsx server/index.ts
        ;;
    *)
        echo "ERROR: Unknown runtime '$RUNTIME'. Use 'python' or 'node'."
        usage
        exit 1
        ;;
esac
