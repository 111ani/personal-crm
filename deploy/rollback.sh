#!/usr/bin/env bash
# Restores the previous local image when the operator selects rollback in
# Deploy prod. The optional database restore is an interactive recovery path.
set -euo pipefail

BACKUP_FILE=
if [ "$#" -ne 0 ]; then
  [ "$#" -eq 2 ] && [ "$1" = --with-database ] || { echo "Usage: rollback.sh [--with-database <backup file>]" >&2; exit 1; }
  BACKUP_FILE=$(realpath -e -- "$2")
fi

CRM_ENVIRONMENT=prod
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
# shellcheck source=database.sh
source "$APP_DIR/deploy/database.sh"

lock_environment
if [ -z "$BACKUP_FILE" ]; then check_restore_complete; fi
check_env_file
CURRENT=$(release_value APP_TAG)
PREVIOUS=$(release_value PREVIOUS_TAG)
[ -n "$PREVIOUS" ] || fail "no previous version in $RELEASE_FILE"
docker image inspect "$IMAGE:$PREVIOUS" >/dev/null 2>&1 ||
  fail "image $IMAGE:$PREVIOUS is not on the server"
PREVIOUS_SCHEMA=$(image_database_schema "$PREVIOUS")
DATABASE=$(database_name)
if [ -n "$BACKUP_FILE" ]; then
  [ -r "$AUTH_BASELINE_FILE" ] || fail "there is no backup recorded for the first sign-in migration"
  BASELINE_TAG=$(sed -n '1p' "$AUTH_BASELINE_FILE")
  BASELINE_BACKUP=$(sed -n '2p' "$AUTH_BASELINE_FILE")
  [ "$BACKUP_FILE" = "$BASELINE_BACKUP" ] || fail "use the recorded sign-in backup: $BASELINE_BACKUP"
  [ "$PREVIOUS" = "$BASELINE_TAG" ] && [ "$PREVIOUS_SCHEMA" = legacy ] ||
    fail "the previous image does not match the recorded sign-in backup"
  CURRENT_SCHEMA=$(image_database_schema "$CURRENT")
  [ "$CURRENT_SCHEMA" = owner-v1 ] || fail "the current release does not use sign-in"

  confirm_database_restore "$BACKUP_FILE" "$DATABASE" "$CURRENT" "$PREVIOUS" || exit 0
  restore_database "$BACKUP_FILE" "$DATABASE" "$CURRENT"
  start_app "$PREVIOUS"
  write_release "$PREVIOUS" "$CURRENT"
  rm -- "$RESTORE_PENDING"
  log "Restored $DATABASE from $BACKUP_FILE and rolled back to $PREVIOUS"
  exit 0
fi

DB_SCHEMA=$(database_schema "$DATABASE")
if [ "$PREVIOUS_SCHEMA" != "$DB_SCHEMA" ]; then
  fail "the previous image uses a different database schema. Follow the sign-in rollback instructions in README.md"
fi

log "Roll back from $CURRENT to $PREVIOUS"
write_release "$PREVIOUS" "$CURRENT"
start_app "$PREVIOUS"
prune_production_images "$PREVIOUS" "$CURRENT"

log "Rolled back to $PREVIOUS. To return, run this script again"
