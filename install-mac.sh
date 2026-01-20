#!/bin/bash
# ARUS Mac Installation Script
# Simple one-command installation for macOS

set -e  # Exit on any error

echo "======================================"
echo "   ARUS Mac Installer"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Recommended version: 20.x or higher"
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js detected: $NODE_VERSION"
echo ""

# Check if we're in the right directory (has package.json)
if [ -f "package.json" ]; then
    echo "✓ Already in ARUS directory"
    INSTALL_DIR="."
else
    echo "Installing to: $(pwd)/RecipeRealm"
    INSTALL_DIR="RecipeRealm"
    mkdir -p "$INSTALL_DIR"
fi

echo ""
echo "→ Installing dependencies..."
npm ci --prefer-offline --no-audit 2>/dev/null || npm install --prefer-offline --no-audit

echo ""
echo "→ Rebuilding native modules for your system..."
echo "   This may take a few minutes..."
npm rebuild sharp
npm rebuild @tensorflow/tfjs-node --build-addon-from-source

echo ""
echo "→ Creating data directory..."
mkdir -p data

echo ""
echo "======================================"
echo "✅ Installation Complete!"
echo "======================================"
echo ""
echo "To start the application:"
echo "  npx electron ."
echo ""
echo "Or add to your Applications folder:"
echo "  npm run electron:build"
echo ""

# Ask if they want to launch now
read -p "Launch ARUS now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Launching ARUS..."
    npx electron .
fi
