#!/usr/bin/env bash

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
info()   { printf "  \033[36m→\033[0m %s\n" "$1"; }
success(){ printf "  \033[32m✓\033[0m %s\n" "$1"; }

print_section() {
  echo ""
  echo "── $1 ──"
}

run_silent() {
  "$@" >/dev/null 2>&1
}

assert_prerequisites() {
  print_section "Prerequisites"
  local ok=true

  if ! command -v opencode &>/dev/null; then
    red "  opencode CLI not found"
    ok=false
  else
    success "opencode: $(opencode --version 2>/dev/null || echo 'installed')"
  fi

  if ! command -v node &>/dev/null; then
    red "  node not found"
    ok=false
  else
    success "node: $(node --version)"
  fi

  if ! command -v git &>/dev/null; then
    red "  git not found"
    ok=false
  else
    success "git: $(git --version)"
  fi

  if [ "$ok" = false ]; then
    red "Prerequisites not met. Aborting."
    exit 1
  fi

  if [ ! -f "$OCB_ROOT/dist/index.js" ]; then
    info "Building ocb..."
    (cd "$OCB_ROOT" && npm run build)
  fi
}

create_session() {
  local message="${1:-hi}"
  local output
  output=$(opencode run "$message" --format json --model "minimax-cn-coding-plan/MiniMax-M2.7" 2>&1)

  if [ -z "$output" ]; then
    echo ""
    return
  fi

  local sid
  sid=$(echo "$output" | grep '"type":"session"' | head -1 | sed -n 's/.*"id":"\(ses_[^"]*\)".*/\1/p')

  if [ -z "$sid" ]; then
    sid=$(echo "$output" | grep -o 'ses_[a-zA-Z0-9]*' | head -1)
  fi

  if [ -z "$sid" ]; then
    echo "ERROR: could not extract SID from output:" >&2
    echo "$output" | head -5 >&2
  fi

  echo "$sid"
}
