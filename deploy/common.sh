# Shared by deploy.sh and rollback.sh; not run on its own.

APP_DIR=/srv/personal-crm
IMAGE=ghcr.io/111ani/personal-crm
APP_HOST=app.lena-14.ru
RELEASE_FILE="$APP_DIR/release.env"

# sudo -u app-deploy keeps the caller's directory, which app-deploy cannot read
cd "$APP_DIR"

log() {
  printf '\n==> %s\n' "$*"
}

fail() {
  printf '\nERROR: %s\n' "$*" >&2
  exit 1
}

compose() {
  docker compose -p prod -f "$APP_DIR/deploy/compose.yaml" \
    --env-file "$APP_DIR/.env" --env-file "$RELEASE_FILE" "$@"
}

# Prints a value from release.env (APP_TAG or PREVIOUS_TAG), empty if unset
release_value() {
  sed -n "s/^$1=//p" "$RELEASE_FILE" 2>/dev/null | tail -n 1
}

write_release() {
  printf 'APP_TAG=%s\nPREVIOUS_TAG=%s\n' "$1" "$2" >"$RELEASE_FILE.tmp"
  mv "$RELEASE_FILE.tmp" "$RELEASE_FILE"
}

check_env_file() {
  [ -f "$APP_DIR/.env" ] || fail "$APP_DIR/.env is missing: see README.md, section about deploy"
  if [ "$(stat -c %a "$APP_DIR/.env")" != 600 ]; then
    chmod 600 "$APP_DIR/.env"
    echo "Set permissions of .env to 600"
  fi
}

# Starts the app with tag $1, waits for its healthcheck, then checks /health
# through nginx the same way a browser does
start_app() {
  APP_TAG="$1" compose up -d --wait --wait-timeout 180 app ||
    fail "the app container with image $1 did not become healthy. Logs: docker logs prod-app-1"

  log "Smoke: https://$APP_HOST/health"
  curl -fsS --retry 5 --retry-delay 3 --retry-all-errors --max-time 10 \
    --resolve "$APP_HOST:443:127.0.0.1" "https://$APP_HOST/health" ||
    fail "smoke /health failed for image $1"
  echo
}
