#!/usr/bin/env bash
# The one green check for the backend.
#
# Runs, in order:
#   1. ruff check (lint + annotation coverage via ANN rules)
#   2. mypy       (deep type check + Pydantic model call-site validation)
#   3. pytest     (functional regression — type-coverage gate + full suite)
#
# Exits non-zero on the first failing step. Intended for pre-push hooks, CI,
# or anyone running `bash scripts/check.sh` locally.

set -u -o pipefail

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

step() { printf "\n${BOLD}▶ %s${NC}\n" "$*"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$*"; }
fail() { printf "${RED}✗ %s${NC}\n" "$*"; exit 1; }

# -- 1. Ruff -----------------------------------------------------------------
step "ruff check (lint + annotation coverage)"
if ! ruff check --config pyproject.toml server.py routes/ utils/ models.py; then
    fail "ruff found issues — fix above, then re-run"
fi
ok "ruff clean"

# -- 2. Mypy ------------------------------------------------------------------
step "mypy (type check + Pydantic model calls)"
if ! mypy --config-file mypy.ini --no-error-summary server.py routes/ utils/ models.py; then
    fail "mypy found type errors — fix above, then re-run"
fi
ok "mypy clean"

# -- 3. Pytest type-coverage gate ---------------------------------------------
step "pytest type-coverage gate"
if ! pytest tests/test_type_coverage.py -q; then
    fail "type-coverage gate regressed"
fi
ok "pytest gate passed"

printf "\n${GREEN}${BOLD}✓ All checks passed.${NC}\n"
