#!/usr/bin/env bash
# Compare the two P3.2.e API-origin modes against a running local Worker.
#
# Prereq:
#   pnpm db:up
#   pnpm db:migrate
#   pnpm dev
#
# Validates:
#   1. Path-based same-origin style calls need no CORS response headers.
#   2. Better Auth session cookies are host-only (no Domain attribute).
#   3. Cross-origin api.leverie.dev-style calls require credentialed CORS.
#   4. Unlisted origins do not get Access-Control-Allow-Origin.

set -euo pipefail

BASE="${BASE:-http://localhost:8787}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:5173}"
BLOCKED_ORIGIN="${BLOCKED_ORIGIN:-https://not-allowed.example}"
PASSWORD="${PASSWORD:-origin-smoke-password-min-12}"
EMAIL="origin-smoke-$(date +%s)@example.test"

COOKIE_JAR="$(mktemp)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -f "$COOKIE_JAR"
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

header_value() {
  local header_file="$1"
  local header_name="$2"
  awk -v name="$(printf '%s' "$header_name" | tr '[:upper:]' '[:lower:]')" '
    BEGIN { FS=":" }
    {
      key=tolower($1)
      if (key == name) {
        sub(/^[^:]*:[ \t]*/, "")
        sub(/\r$/, "")
        print
      }
    }
  ' "$header_file" | tail -n 1
}

all_header_values() {
  local header_file="$1"
  local header_name="$2"
  awk -v name="$(printf '%s' "$header_name" | tr '[:upper:]' '[:lower:]')" '
    BEGIN { FS=":" }
    {
      key=tolower($1)
      if (key == name) {
        sub(/^[^:]*:[ \t]*/, "")
        sub(/\r$/, "")
        print
      }
    }
  ' "$header_file"
}

assert_eq() {
  local expected="$1"
  local actual="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    exit 1
  fi
}

assert_empty() {
  local actual="$1"
  local label="$2"
  if [[ -n "$actual" ]]; then
    echo "FAIL: $label"
    echo "  expected empty, got: $actual"
    exit 1
  fi
}

assert_contains() {
  local needle="$1"
  local haystack="$2"
  local label="$3"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "FAIL: $label"
    echo "  missing: $needle"
    echo "  in:      $haystack"
    exit 1
  fi
}

assert_not_contains() {
  local needle="$1"
  local haystack="$2"
  local label="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "FAIL: $label"
    echo "  unexpected: $needle"
    echo "  in:         $haystack"
    exit 1
  fi
}

echo "==> [1/6] health check"
HEALTH="$(curl -fsS "$BASE/healthz")"
assert_contains '"ok":true' "$HEALTH" "healthz"
echo "    ok"

echo "==> [2/6] same-origin-style sign-up has no ACAO header"
SIGNUP_HEADERS="$TMP_DIR/signup.headers"
SIGNUP_BODY="$TMP_DIR/signup.json"
curl -fsS -D "$SIGNUP_HEADERS" -o "$SIGNUP_BODY" -X POST "$BASE/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"Origin Smoke\"}"
assert_contains '"user"' "$(cat "$SIGNUP_BODY")" "sign-up response"
assert_empty "$(header_value "$SIGNUP_HEADERS" "Access-Control-Allow-Origin")" "same-origin ACAO"
echo "    ok"

echo "==> [3/6] Better Auth session cookie is host-only"
SET_COOKIE="$(all_header_values "$SIGNUP_HEADERS" "Set-Cookie")"
assert_contains 'better-auth.session_token=' "$SET_COOKIE" "session Set-Cookie"
assert_not_contains 'Domain=' "$SET_COOKIE" "session cookie Domain"
assert_contains 'SameSite=Lax' "$SET_COOKIE" "session cookie SameSite"
echo "    ok"

echo "==> [4/6] cookie round-trip resolves /api/me"
ME="$(curl -fsS "$BASE/api/me" -b "$COOKIE_JAR")"
assert_contains "\"email\":\"$EMAIL\"" "$ME" "/api/me"
echo "    ok"

echo "==> [5/6] api.leverie.dev-style preflight requires credentialed CORS"
PREFLIGHT_HEADERS="$TMP_DIR/preflight.headers"
curl -fsS -D "$PREFLIGHT_HEADERS" -o /dev/null -X OPTIONS "$BASE/api/auth/sign-in/email" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
assert_eq "$FRONTEND_ORIGIN" "$(header_value "$PREFLIGHT_HEADERS" "Access-Control-Allow-Origin")" "preflight ACAO"
assert_eq "true" "$(header_value "$PREFLIGHT_HEADERS" "Access-Control-Allow-Credentials")" "preflight ACAC"
echo "    ok"

echo "==> [6/6] credentialed cross-origin reads reflect only allowlisted origins"
CROSS_HEADERS="$TMP_DIR/cross.headers"
CROSS_BODY="$TMP_DIR/cross.json"
curl -fsS -D "$CROSS_HEADERS" -o "$CROSS_BODY" "$BASE/api/me" \
  -H "Origin: $FRONTEND_ORIGIN" \
  -b "$COOKIE_JAR"
assert_contains "\"email\":\"$EMAIL\"" "$(cat "$CROSS_BODY")" "cross-origin /api/me"
assert_eq "$FRONTEND_ORIGIN" "$(header_value "$CROSS_HEADERS" "Access-Control-Allow-Origin")" "cross-origin ACAO"
assert_eq "true" "$(header_value "$CROSS_HEADERS" "Access-Control-Allow-Credentials")" "cross-origin ACAC"

BLOCKED_HEADERS="$TMP_DIR/blocked.headers"
curl -fsS -D "$BLOCKED_HEADERS" -o /dev/null -X OPTIONS "$BASE/api/auth/sign-in/email" \
  -H "Origin: $BLOCKED_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
assert_empty "$(header_value "$BLOCKED_HEADERS" "Access-Control-Allow-Origin")" "blocked ACAO"
echo "    ok"

echo
echo "Origin checks passed."
