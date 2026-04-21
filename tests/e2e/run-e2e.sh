#!/usr/bin/env bash
set -euo pipefail

OCB_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST_DIR="/tmp/ocb-e2e-$$"
TASK_FILE="${1:-$OCB_ROOT/tests/e2e/task.json}"

source "$OCB_ROOT/tests/e2e/lib.sh"

PASSED=0
FAILED=0
SKIPPED=0
TOTAL=0

cleanup() {
  print_section "Cleanup"
  if [ -f "$TEST_DIR/session-ids.env" ]; then
    source "$TEST_DIR/session-ids.env"
    for var in $(compgen -v | grep '_SID$'); do
      sid="${!var}"
      if [ -n "$sid" ]; then
        run_silent opencode session delete "$sid" 2>/dev/null || true
      fi
    done
  fi
  rm -rf "$TEST_DIR"
  info "Cleaned up $TEST_DIR"
}
trap cleanup EXIT

# ── Setup ──
setup() {
  print_section "Setup"
  info "Test dir: $TEST_DIR"

  mkdir -p "$TEST_DIR/project-a" "$TEST_DIR/project-b"

  for proj in project-a project-b; do
    local dir="$TEST_DIR/$proj"
    echo "# Test Project $proj" > "$dir/README.md"
    git init -q "$dir"
    git -C "$dir" add .
    git -C "$dir" commit -qm "init" --allow-empty
  done

  # Create sessions
  info "Creating test sessions (this uses opencode run and costs tokens)..."

  cd "$TEST_DIR/project-a"
  info "  Creating pa-s1..."
  PA_S1_SID=$(create_session "[E2E-PA-S1]")
  info "  pa-s1: $PA_S1_SID"

  info "  Creating pa-s2..."
  PA_S2_SID=$(create_session "[E2E-PA-S2]")
  info "  pa-s2: $PA_S2_SID"

  info "  Creating pa-s3..."
  PA_S3_SID=$(create_session "[E2E-PA-S3]")
  info "  pa-s3: $PA_S3_SID"

  cd "$TEST_DIR/project-b"

  info "  Creating pb-s1..."
  PB_S1_SID=$(create_session "[E2E-PB-S1]")
  info "  pb-s1: $PB_S1_SID"

  cat > "$TEST_DIR/session-ids.env" <<EOF
PA_S1_SID=$PA_S1_SID
PA_S2_SID=$PA_S2_SID
PA_S3_SID=$PA_S3_SID
PB_S1_SID=$PB_S1_SID
EOF

  info "Waiting for sessions to idle..."
  sleep 5

  success "All sessions created"
}

run_test() {
  local id="$1" name="$2" cwd="$3" cmd="$4" exit_expected="${5:-0}"
  shift 5
  local assert_patterns=()
  local assert_not_patterns=()
  local min_lines=0

  while [ $# -gt 0 ]; do
    case "$1" in
      --assert) shift; assert_patterns+=("$1") ;;
      --assert-not) shift; assert_not_patterns+=("$1") ;;
      --min-lines) shift; min_lines="$1" ;;
    esac
    shift
  done

  TOTAL=$((TOTAL + 1))
  printf "  %-5s %s ... " "$id" "$name"

  local output exit_code
  cd "$TEST_DIR/$cwd"

  set +e
  output=$(eval "$cmd" 2>&1)
  exit_code=$?
  set -e

  # Check skip
  if echo "$output" | grep -q "not implemented\|not found.*command"; then
    if [ "$exit_expected" = "skip" ]; then
      yellow "SKIP"
      SKIPPED=$((SKIPPED + 1))
      return
    fi
  fi

  local failed=false

  if [ "$exit_expected" != "skip" ] && [ "$exit_code" -ne "$exit_expected" ]; then
    failed=true
    red "FAIL"
    echo "    Expected exit code $exit_expected, got $exit_code"
    echo "    Output: $(echo "$output" | head -3)"
  fi

  for pattern in "${assert_patterns[@]+"${assert_patterns[@]}"}"; do
    if ! echo "$output" | grep -q "$pattern"; then
      failed=true
      [ "$failed" = true ] && red "FAIL"
      echo "    Expected pattern not found: $pattern"
    fi
  done

  for pattern in "${assert_not_patterns[@]+"${assert_not_patterns[@]}"}"; do
    if echo "$output" | grep -q "$pattern"; then
      failed=true
      [ "$failed" = true ] && red "FAIL"
      echo "    Unexpected pattern found: $pattern"
    fi
  done

  if [ "$min_lines" -gt 0 ]; then
    local line_count
    line_count=$(echo "$output" | wc -l | tr -d ' ')
    if [ "$line_count" -lt "$min_lines" ]; then
      failed=true
      [ "$failed" = true ] && red "FAIL"
      echo "    Expected >= $min_lines lines, got $line_count"
    fi
  fi

  if [ "$failed" = false ]; then
    green "PASS"
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
}

# ── Phase 1 Tests ──
run_phase1() {
  print_section "Phase 1: View + Naming"
  source "$TEST_DIR/session-ids.env"

  run_test T01 "origin available lists all unmanaged" project-a \
    "ocb origin available" 0 \
    --assert "${PA_S1_SID:0:15}" --assert "${PA_S2_SID:0:15}" --assert "${PA_S3_SID:0:15}" --assert-not "${PB_S1_SID:0:15}"

  run_test T02 "attach by explicit session id" project-a \
    "ocb attach auth-feature -s $PA_S1_SID" 0 \
    --assert "Created: auth-feature"

  run_test T03 "attach second session by sid" project-a \
    "ocb attach fix-css -s $PA_S2_SID" 0 \
    --assert "Created: fix-css"

  run_test T04 "list shows 2 managed sessions" project-a \
    "ocb list" 0 \
    --assert "auth-feature" --assert "fix-css" --assert-not "${PA_S3_SID:0:15}"

  run_test T05 "origin available only shows pa-s3" project-a \
    "ocb origin available" 0 \
    --assert "${PA_S3_SID:0:15}" --assert-not "auth-feature" --assert-not "fix-css"

  run_test T06 "show displays message list" project-a \
    "ocb show auth-feature" 0 \
    --assert "User" --min-lines 2

  run_test T07 "show -m shows specific message" project-a \
    "ocb show auth-feature -m 1" 0 \
    --assert "[E2E-PA-S1]"

  run_test T08 "checkout switches active session" project-a \
    "ocb checkout auth-feature" 0 \
    --assert "Switched to auth-feature"

  run_test T09 "list shows * on active" project-a \
    "ocb list" 0 \
    --assert "* auth-feature"

  run_test T10 "rename changes alias" project-a \
    "ocb rename auth-feature login-module" 0 \
    --assert "Renamed:" --assert "login-module"

  run_test T11 "list reflects new name" project-a \
    "ocb list" 0 \
    --assert "login-module" --assert "fix-css" --assert-not "auth-feature"

  run_test T12 "show works with new name" project-a \
    "ocb show login-module -m 1" 0 \
    --assert "[E2E-PA-S1]"

  run_test T13 "show works with raw session id" project-a \
    "ocb show $PA_S1_SID -m 1" 0 \
    --assert "[E2E-PA-S1]"

  run_test T14 "unmanage removes from list" project-a \
    "ocb unmanage fix-css" 0 \
    --assert "Removed fix-css"

  run_test T15 "list no longer shows unmanaged" project-a \
    "ocb list" 0 \
    --assert "login-module" --assert-not "fix-css"

  run_test T16 "origin available shows unmanaged again" project-a \
    "ocb origin available" 0 \
    --assert "${PA_S2_SID:0:15}"

  run_test T17 "cross-project isolation" project-b \
    "ocb list" 0 \
    --assert "No managed sessions"

  run_test T17b "attach without -s picks most recent in project-b" project-b \
    "ocb attach api-work" 0 \
    --assert "Created: api-work" --assert "${PB_S1_SID:0:15}"

  run_test T18 "project-b list shows own only" project-b \
    "ocb list" 0 \
    --assert "api-work" --assert-not "login-module" --assert-not "fix-css"

  run_test T19 "project-b show works" project-b \
    "ocb show api-work" 0 \
    --assert "User" --min-lines 2

  run_test T20 "delete -f removes session" project-a \
    "ocb delete $PA_S3_SID -f" 0 \
    --assert "Deleted"

  run_test T21 "deleted not in origin available" project-a \
    "ocb origin available" 0 \
    --assert-not "${PA_S3_SID:0:15}"

  run_test T22 "show nonexistent returns error" project-a \
    "ocb show nonexistent-xyz" 1 \
    --assert "Error"
}

# ── Main ──
main() {
  echo ""
  echo "╔════════════════════════════════════════════╗"
  echo "║         ocb E2E Test Suite                 ║"
  echo "╚════════════════════════════════════════════╝"
  echo ""
  info "ocb root: $OCB_ROOT"
  info "task:     $TASK_FILE"
  info ""

  assert_prerequisites

  setup
  run_phase1

  echo ""
  echo "════════════════════════════════════════════"
  if [ "$FAILED" -eq 0 ]; then
    success "All tests passed: $PASSED/$TOTAL"
  else
    red "FAILED: $PASSED passed, $FAILED failed, $SKIPPED skipped out of $TOTAL"
    exit 1
  fi
  echo "════════════════════════════════════════════"
}

main
