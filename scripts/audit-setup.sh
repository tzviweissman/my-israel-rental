#!/usr/bin/env bash
# Start a working copy of the site inside an audit's cloud sandbox, so the
# audit can render pages, run the tests and click through flows instead of
# reading code and guessing (Tzvi, 12 Oct 2026: "can we make the audits
# better"; until then every nightly report ended with a long "not checked"
# list: no Playwright, no database, no backend packages, live site blocked).
#
#   bash scripts/audit-setup.sh            # everything
#   bash scripts/audit-setup.sh --no-app   # tools and tests only, no servers
#
# What it gives you when it works:
#   * MongoDB on 127.0.0.1:27017, database israel_rental_audit (local, empty
#     apart from the seeded test accounts and demo listings)
#   * the API on http://localhost:8001 with DEV_AUTOLOGIN=1, so any page
#     opened with ?as=owner|renter|provider|admin is already signed in
#   * the site on http://localhost:3210 (the dev server, so ?as= works)
#   * Playwright with Chromium, at the repo root, for every scripts/*.mjs
#     and the build-business-page checks (clipped, readable, cutout)
#   * backend/.venv with the backend's packages, for pytest
#
# It never prints a secret, never touches production, and has no secrets to
# print: every value it sets is a throwaway made up here.
#
# Each step reports OK or FAILED on one line, and the summary is written to
# /tmp/audit-setup.txt. A FAILED step is not a reason to stop the audit:
# copy that line into the report's "Not checked" section and carry on with
# what did start.
set -u
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT"
LOG=/tmp/audit-setup.log
SUM=/tmp/audit-setup.txt
: > "$LOG"; : > "$SUM"
APP=1; [ "${1:-}" = "--no-app" ] && APP=0
say() { echo "$1" | tee -a "$SUM"; }
step() { # step "name" command...
  local name=$1; shift
  if "$@" >>"$LOG" 2>&1; then say "OK      $name"; return 0; fi
  say "FAILED  $name (last lines: $(tail -3 "$LOG" | tr '\n' ' ' | cut -c1-220))"; return 1
}
wait_for() { # wait_for url seconds
  for _ in $(seq 1 "$2"); do curl -s -o /dev/null "$1" && return 0; sleep 1; done; return 1
}

# 1. Backend packages, in a venv (the system Python in the sandbox is
#    missing _cffi_backend, so pymongo and cryptography fail to import).
#    jq is pinned in requirements but unused and often has no wheel.
py_setup() {
  python3 -m venv backend/.venv &&
  grep -v -E '^(jq)==' backend/requirements.txt > /tmp/req.txt &&
  backend/.venv/bin/pip install -q --upgrade pip &&
  backend/.venv/bin/pip install -q -r /tmp/req.txt pytest
}
step "backend packages (backend/.venv)" py_setup
PY="$ROOT/backend/.venv/bin/python"

# 2. Playwright + Chromium at the repo root (package.json declares it).
step "playwright + chromium" bash -c "npm install --no-audit --no-fund -s && npx playwright install --with-deps chromium"

[ "$APP" = 0 ] && { say "SKIPPED servers (--no-app)"; exit 0; }

# 3. MongoDB. The official Linux build, unpacked under /tmp.
mongo_setup() {
  if ! command -v mongod >/dev/null; then
    . /etc/os-release
    local v=${VERSION_ID//./}; case "$v" in 2[4-9]*) v=2404;; 22*) v=2204;; *) v=2004;; esac
    curl -fsSL "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu${v}-8.0.4.tgz" -o /tmp/mongo.tgz &&
    tar -xzf /tmp/mongo.tgz -C /tmp && ln -sf /tmp/mongodb-linux-*/bin/mongod /usr/local/bin/mongod || return 1
  fi
  mkdir -p /tmp/mongo-data &&
  (mongod --dbpath /tmp/mongo-data --bind_ip 127.0.0.1 --port 27017 --fork --logpath /tmp/mongod.log)
}
step "mongodb on :27017" mongo_setup || NO_DB=1

# 4. The API. Throwaway settings only; payment, email, WhatsApp and LLM keys
#    are left unset, so those features stay off rather than calling out.
export MONGO_URL=mongodb://127.0.0.1:27017 DB_NAME=israel_rental_audit
export JWT_SECRET=$(head -c 32 /dev/urandom | base64) DEV_AUTOLOGIN=1 DISABLE_RATE_LIMIT=1
export CORS_ORIGINS=http://localhost:3210 FRONTEND_URL=http://localhost:3210
if [ -z "${NO_DB:-}" ]; then
  (cd backend && "$PY" scripts/seed_test_accounts.py >>"$LOG" 2>&1 \
     && "$PY" -m scripts.seed_demo_gigs --wipe --provider-email owner@test.com >>"$LOG" 2>&1) \
     && say "OK      seeded test accounts and demo listings" || say "FAILED  seeding (see $LOG)"
  cat > backend/tests/.env.test <<EOF
TEST_ADMIN_EMAIL=admin@rental.com
TEST_ADMIN_PASSWORD=Admin1234!
TEST_OWNER_EMAIL=owner@test.com
TEST_OWNER_PASSWORD=Test1234!
TEST_RENTER_EMAIL=renter@test.com
TEST_RENTER_PASSWORD=Test1234!
TEST_API_BASE=http://localhost:8001/api
EOF
  (cd backend && nohup "$PY" -m uvicorn server:app --port 8001 > /tmp/api.log 2>&1 &)
  step "api on :8001" wait_for http://localhost:8001/api/health 90
else
  say "SKIPPED api (no database)"
fi

# 5. The site, as the dev server (so ?as=owner signs in).
web_setup() {
  (cd frontend && [ -d node_modules ] || npm install --legacy-peer-deps --no-audit --no-fund -s) || return 1
  printf 'REACT_APP_BACKEND_URL=http://localhost:8001\n' > frontend/.env.local
  (cd frontend && BROWSER=none PORT=3210 nohup npx craco start > /tmp/web.log 2>&1 &)
  wait_for http://localhost:3210/ 240
}
step "site on :3210" web_setup

echo; echo "Setup summary (also in $SUM):"; cat "$SUM"
