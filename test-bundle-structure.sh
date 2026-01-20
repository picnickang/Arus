#!/bin/bash
# Quick test of bundle structure without full build

BUNDLE_DIR="dist-standalone/ARUS-bundle"
mkdir -p "$BUNDLE_DIR"

echo "Testing new bundle structure..."
echo ""

# Copy server directory (new approach)
echo "→ Copying server directory..."
cp -R server "$BUNDLE_DIR/"
echo "✓ Server directory copied: $(du -sh $BUNDLE_DIR/server | cut -f1)"

# Copy client dist
echo "→ Copying client dist..."
mkdir -p "$BUNDLE_DIR/client"
cp -R client/dist "$BUNDLE_DIR/client/" 2>/dev/null || echo "  (client/dist not built yet)"

# Create launcher with tsx
echo "→ Creating launcher..."
cat > "$BUNDLE_DIR/arus-start.sh" << 'LAUNCHER'
#!/bin/bash
export LOCAL_MODE=true
export NODE_ENV=production
export PORT=${PORT:-31888}
cd "$(dirname "$0")" || exit 1
exec node_modules/.bin/tsx server/index.ts
LAUNCHER
chmod +x "$BUNDLE_DIR/arus-start.sh"
echo "✓ Launcher created"

echo ""
echo "Bundle structure:"
ls -lh "$BUNDLE_DIR"
echo ""
echo "Launcher content:"
tail -3 "$BUNDLE_DIR/arus-start.sh"
echo ""
echo "Server files (sample):"
ls "$BUNDLE_DIR/server"/*.ts | head -5
