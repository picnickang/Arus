#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "  ARUS Developer Setup"
echo "  (Not for customer/vessel installation)"
echo "========================================"
echo ""

check_command() {
  if command -v "$1" &>/dev/null; then
    echo "  ✅ $1 found: $($1 --version 2>&1 | head -1)"
    return 0
  else
    echo "  ❌ $1 not found"
    return 1
  fi
}

echo "🔍 Checking prerequisites..."
echo ""

MISSING=0

check_command node || MISSING=1
check_command npm || MISSING=1

echo ""
echo "  Optional (for desktop/Tauri development):"
if check_command rustc; then
  if ! check_command cargo; then
    echo "  ⚠️  cargo is missing but rustc is present — Tauri builds will fail"
    echo "     Reinstall Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  fi
else
  echo "     Install Rust: https://rustup.rs"
  echo "     (Only needed for Tauri desktop builds)"
fi

echo ""

if [ "$MISSING" -eq 1 ]; then
  echo "❌ Missing required tools. Please install them before continuing."
  exit 1
fi

echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "📁 Creating data directory..."
mkdir -p data

echo ""
echo "========================================"
echo "  ✅ Setup Complete"
echo "========================================"
echo ""
echo "  Web development:"
echo "    npm run dev"
echo ""
echo "  Desktop development (requires Rust):"
echo "    npm run tauri:dev"
echo ""
echo "  Desktop build:"
echo "    npm run tauri:build"
echo ""
echo "  Database push:"
echo "    npm run db:push"
echo ""
