#!/bin/bash
# ReleaseIQ — Dev Startup Script
# Always kills existing instances before starting fresh ones

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "======================================"
echo "  ReleaseIQ — Starting Services"
echo "======================================"

# ── Kill any existing instances ──────────────────────────────────────────────
echo "[*] Stopping any existing services..."
fuser -k 8000/tcp 2>/dev/null && echo "    Stopped backend (port 8000)"
fuser -k 3000/tcp 2>/dev/null && echo "    Stopped frontend (port 3000)"
sleep 1

# ── Load NVM ─────────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 20 2>/dev/null || true

# ── Create .env if missing ────────────────────────────────────────────────────
if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "[*] Created .env from .env.example"
fi

# ── Start Backend ─────────────────────────────────────────────────────────────
echo "[*] Starting Backend on http://localhost:8000 ..."
cd "$BACKEND_DIR"
python3 run.py > /tmp/releaseiq_backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
for i in $(seq 1 10); do
  sleep 1
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "    Backend ready ✅ (PID $BACKEND_PID)"
    break
  fi
done

# ── Start Frontend ────────────────────────────────────────────────────────────
echo "[*] Starting Frontend on http://localhost:3000 ..."
cd "$FRONTEND_DIR"
npm run dev > /tmp/releaseiq_frontend.log 2>&1 &
FRONTEND_PID=$!

sleep 3
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "    Frontend ready ✅ (PID $FRONTEND_PID)"
else
  echo "    Frontend starting... (PID $FRONTEND_PID)"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "======================================"
echo "  ✅ ReleaseIQ is Running!"
echo ""
echo "  Frontend : http://localhost:3000"
echo "  Backend  : http://localhost:8000"
echo "  API Docs : http://localhost:8000/docs"
echo ""
echo "  Login    : admin / admin123"
echo "======================================"
echo ""
echo "Logs:"
echo "  Backend  → tail -f /tmp/releaseiq_backend.log"
echo "  Frontend → tail -f /tmp/releaseiq_frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; fuser -k 8000/tcp 2>/dev/null; fuser -k 3000/tcp 2>/dev/null; exit 0" INT TERM
wait
