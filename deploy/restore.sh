#!/usr/bin/env bash
# Restores the production database without changing the app version.
# Run manually on the server as app-deploy.
set -euo pipefail

[ "$#" -eq 1 ] || { echo "Usage: restore.sh <backup file>" >&2; exit 1; }
# Resolve relative paths before common.sh changes the working directory.
BACKUP_FILE=$(realpath -e -- "$1")

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
# shellcheck source=database.sh
source "$APP_DIR/deploy/database.sh"

lock_production
check_env_file

# Compose needs an image tag to load the project even for read-only commands.
APP_CONTAINER=$(APP_TAG=unreleased compose ps --all --quiet app)
[ -n "$APP_CONTAINER" ] || fail "no production app container to restart after restore"
CURRENT=$(container_app_tag "$APP_CONTAINER")
export APP_TAG="$CURRENT"
DATABASE=$(database_name)
confirm_database_restore "$BACKUP_FILE" "$DATABASE" "$CURRENT" "$CURRENT" || exit 0
restore_database "$BACKUP_FILE" "$DATABASE" "$CURRENT"

log "Start the existing production app ($CURRENT)"
compose start --wait --wait-timeout 180 app ||
  fail "the app did not become healthy after restore. Logs: docker logs prod-app-1"
smoke_app "$CURRENT"
rm -- "$RESTORE_PENDING"
log "Restored $DATABASE from $BACKUP_FILE"
