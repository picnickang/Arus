#!/bin/bash
set -e

EXPORT_DIR="code-export"
SEPARATOR="=================================================================="

export_files() {
  local output_file="$1"
  shift
  > "$output_file"
  
  local count=0
  while IFS= read -r file; do
    if [ -f "$file" ]; then
      echo "$SEPARATOR" >> "$output_file"
      echo "FILE: $file" >> "$output_file"
      echo "$SEPARATOR" >> "$output_file"
      cat "$file" >> "$output_file"
      echo "" >> "$output_file"
      echo "" >> "$output_file"
      count=$((count + 1))
    fi
  done
  
  local size=$(wc -c < "$output_file")
  local size_kb=$((size / 1024))
  local size_mb=$((size_kb / 1024))
  echo "  -> $output_file: $count files, ${size_kb} KB (~${size_mb} MB)"
}

echo "Generating code export files..."

echo "1/7: Shared schemas, config, and migrations..."
{
  find shared/ -type f \( -name '*.ts' \) | sort
  find migrations/ -type f \( -name '*.ts' -o -name '*.sql' \) 2>/dev/null | sort
  echo "./package.json"
  echo "./tsconfig.json"
  echo "./vite.config.ts"
  echo "./tailwind.config.ts"
  echo "./capacitor.config.ts"
  echo "./eslint.config.js"
  echo "./jest.config.mjs"
  echo "./knip.json"
  echo "./electron-builder.json"
} | export_files "$EXPORT_DIR/export-1-shared-and-config.txt"

echo "2/7: Server core — routes, db, services, middleware, lib, config..."
{
  find server/ -maxdepth 1 -type f -name '*.ts' | sort
  find server/routes/ -type f -name '*.ts' 2>/dev/null | sort
  find server/db/ -type f -name '*.ts' 2>/dev/null | sort
  find server/services/ -type f -name '*.ts' 2>/dev/null | sort
  find server/middleware/ -type f -name '*.ts' 2>/dev/null | sort
  find server/lib/ -type f -name '*.ts' 2>/dev/null | sort
  find server/config/ -type f -name '*.ts' 2>/dev/null | sort
  find server/utils/ -type f -name '*.ts' 2>/dev/null | sort
  find server/core/ -type f -name '*.ts' 2>/dev/null | sort
  find server/shared/ -type f -name '*.ts' 2>/dev/null | sort
  find server/infrastructure/ -type f -name '*.ts' 2>/dev/null | sort
  find server/scripts/ -type f -name '*.ts' 2>/dev/null | sort
  find server/scheduler/ -type f -name '*.ts' 2>/dev/null | sort
} | export_files "$EXPORT_DIR/export-2a-server-core.txt"

echo "3/7: Server extended — storage, telemetry, pdm, compliance, integrations, tests..."
{
  find server/storage/ -type f -name '*.ts' 2>/dev/null | sort
  find server/telemetry/ -type f -name '*.ts' 2>/dev/null | sort
  find server/pdm/ -type f -name '*.ts' 2>/dev/null | sort
  find server/compliance/ -type f -name '*.ts' 2>/dev/null | sort
  find server/integrations/ -type f -name '*.ts' 2>/dev/null | sort
  find server/purchasing/ -type f -name '*.ts' 2>/dev/null | sort
  find server/observability/ -type f -name '*.ts' 2>/dev/null | sort
  find server/sqlite/ -type f -name '*.ts' 2>/dev/null | sort
  find server/domain/ -type f -name '*.ts' 2>/dev/null | sort
  find server/tests/ -type f -name '*.ts' 2>/dev/null | sort
  find server/ -type f -name '*.ts' ! -path 'server/domains/*' \
    ! -path 'server/routes/*' ! -path 'server/db/*' ! -path 'server/services/*' \
    ! -path 'server/middleware/*' ! -path 'server/lib/*' ! -path 'server/config/*' \
    ! -path 'server/utils/*' ! -path 'server/core/*' ! -path 'server/shared/*' \
    ! -path 'server/infrastructure/*' ! -path 'server/scripts/*' ! -path 'server/scheduler/*' \
    ! -path 'server/storage/*' ! -path 'server/telemetry/*' ! -path 'server/pdm/*' \
    ! -path 'server/compliance/*' ! -path 'server/integrations/*' ! -path 'server/purchasing/*' \
    ! -path 'server/observability/*' ! -path 'server/sqlite/*' ! -path 'server/domain/*' \
    ! -path 'server/tests/*' -mindepth 2 2>/dev/null | sort
} | export_files "$EXPORT_DIR/export-2b-server-extended.txt"

echo "4/7: Server domains (A-H)..."
find server/domains/ -type f -name '*.ts' | sort | awk -F/ '{if ($3 <= "h") print}' | export_files "$EXPORT_DIR/export-3-server-domains-ah.txt"

echo "5/7: Server domains (I-Z)..."
find server/domains/ -type f -name '*.ts' | sort | awk -F/ '{if ($3 > "h") print}' | export_files "$EXPORT_DIR/export-4-server-domains-iz.txt"

echo "6/7: Client pages, features, hooks, lib..."
{
  find client/src/pages/ -type f \( -name '*.ts' -o -name '*.tsx' \) | sort
  find client/src/features/ -type f \( -name '*.ts' -o -name '*.tsx' \) | sort
  find client/src/hooks/ -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | sort
  find client/src/lib/ -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | sort
  find client/src/ -maxdepth 1 -type f \( -name '*.ts' -o -name '*.tsx' \) | sort
} | export_files "$EXPORT_DIR/export-5-client-pages-features.txt"

echo "7/7: Client components..."
find client/src/components/ -type f \( -name '*.ts' -o -name '*.tsx' \) | sort | export_files "$EXPORT_DIR/export-6-client-components.txt"

echo ""
echo "Done! Files in $EXPORT_DIR/:"
ls -lh "$EXPORT_DIR"/export-*.txt
echo ""
echo "Total size:"
du -sh "$EXPORT_DIR"/export-*.txt | tail -1
