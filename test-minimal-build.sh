#!/bin/bash
set -e

echo "Building minimal server..."
npm run build 2>&1 | head -20 &
sleep 2

# Override with minimal server
echo "Compiling minimal server..."
npx esbuild server/minimal-server.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

echo "✓ Minimal server built to dist/index.js"
echo ""
echo "File size:"
ls -lh dist/index.js

echo ""
echo "Testing locally first..."
LOCAL_MODE=true PORT=31999 node dist/index.js &
TEST_PID=$!
sleep 3

if curl -s http://localhost:31999/api/health | grep -q "ok"; then
  echo "✅ Minimal server works locally!"
  kill $TEST_PID 2>/dev/null || true
else
  echo "❌ Minimal server failed locally"
  kill $TEST_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "Ready to deploy to installed location"
