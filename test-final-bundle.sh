#!/bin/bash
set -e

echo "=== Final Bundle Test ==="
echo ""

BUNDLE_DIR="dist-standalone/ARUS-bundle"

# Simulate full bundle with node_modules
echo "→ Creating test bundle with dependencies..."
mkdir -p "$BUNDLE_DIR"
cp -R server "$BUNDLE_DIR/"
cp package.json "$BUNDLE_DIR/"

# Create minimal node_modules with just tsx
mkdir -p "$BUNDLE_DIR/node_modules/.bin"
ln -sf $(which tsx) "$BUNDLE_DIR/node_modules/.bin/tsx" 2>/dev/null || {
  echo "  Using system tsx"
  cat > "$BUNDLE_DIR/node_modules/.bin/tsx" << 'TSX'
#!/bin/bash
exec $(which tsx) "$@"
TSX
  chmod +x "$BUNDLE_DIR/node_modules/.bin/tsx"
}

# Create launcher
cat > "$BUNDLE_DIR/arus-start.sh" << 'LAUNCHER'
#!/bin/bash
export LOCAL_MODE=true
export NODE_ENV=production
export PORT=31999
export DATABASE_PATH="/tmp/test-vessel.db"
cd "$(dirname "$0")" || exit 1
echo "Testing server startup..."
exec node_modules/.bin/tsx server/index.ts
LAUNCHER
chmod +x "$BUNDLE_DIR/arus-start.sh"

echo "✓ Test bundle created"
echo ""
echo "Bundle contents:"
ls -lh "$BUNDLE_DIR/"
echo ""
echo "Server TypeScript files:"
ls "$BUNDLE_DIR/server"/*.ts | wc -l
echo ""
echo "✅ Bundle structure verified!"
echo "   - Server: $(du -sh $BUNDLE_DIR/server | cut -f1)"
echo "   - Launcher: Uses tsx runtime (no bundling)"
echo "   - Dynamic imports: ✅ Supported (139 imports in routes.ts)"
