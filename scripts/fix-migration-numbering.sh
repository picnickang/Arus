#!/bin/bash
# ============================================================================
# Fix migration numbering collision
# Two files share the 0010 prefix. Renumber the second to 0011.
# Also add the unnumbered add-conflict-resolution.sql to the sequence.
# ============================================================================

set -e

MIGRATIONS_DIR="migrations"

echo "=== Fixing migration numbering ==="

# Rename the second 0010 to 0011
if [ -f "$MIGRATIONS_DIR/0010_cost_savings_validation_status.sql" ]; then
  mv "$MIGRATIONS_DIR/0010_cost_savings_validation_status.sql" \
     "$MIGRATIONS_DIR/0011_cost_savings_validation_status.sql"
  echo "✓ Renamed 0010_cost_savings_validation_status.sql → 0011_cost_savings_validation_status.sql"
fi

# Rename the unnumbered migration to 0012
if [ -f "$MIGRATIONS_DIR/add-conflict-resolution.sql" ]; then
  mv "$MIGRATIONS_DIR/add-conflict-resolution.sql" \
     "$MIGRATIONS_DIR/0012_add_conflict_resolution.sql"
  echo "✓ Renamed add-conflict-resolution.sql → 0012_add_conflict_resolution.sql"
fi

echo ""
echo "=== Migration sequence ==="
ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort
echo ""
echo "Done. Verify the sequence is correct, then commit."
