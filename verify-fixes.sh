#!/bin/bash

echo "🔍 ELECTRON FIXES VERIFICATION SCRIPT"
echo "======================================"
echo ""

ERRORS=0

echo "1️⃣ Checking package.json main field..."
if grep -q '"main": "dist-electron/main.cjs"' package.json; then
  echo "   ✅ PASS: Main field points to main.cjs"
else
  echo "   ❌ FAIL: Main field still points to main.js (should be main.cjs)"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "2️⃣ Checking build:server script..."
if grep -q 'build:server.*--outfile=server/index.js' package.json; then
  echo "   ✅ PASS: build:server outputs to server/index.js"
else
  echo "   ❌ FAIL: build:server script missing or incorrect"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "3️⃣ Checking build:electron-main script..."
if grep -q 'build:electron-main' package.json; then
  echo "   ✅ PASS: build:electron-main script exists"
else
  echo "   ❌ FAIL: build:electron-main script missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "4️⃣ Checking build:electron script..."
if grep -q 'build:electron' package.json; then
  echo "   ✅ PASS: build:electron script exists"
else
  echo "   ❌ FAIL: build:electron script missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "5️⃣ Checking platform build scripts..."
if grep -q 'dist:mac' package.json && grep -q 'dist:win' package.json && grep -q 'dist:linux' package.json; then
  echo "   ✅ PASS: Platform-specific scripts exist"
else
  echo "   ❌ FAIL: Platform-specific scripts missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

echo "======================================"
if [ $ERRORS -eq 0 ]; then
  echo "🎉 ALL CHECKS PASSED!"
  echo "   You can now build the Electron app"
  echo ""
  echo "   Try: npm run build:electron"
else
  echo "⚠️  $ERRORS CHECK(S) FAILED"
  echo "   Please review CRITICAL_FIXES_REQUIRED.md"
  echo "   and apply the necessary changes"
fi
echo "======================================"

exit $ERRORS
