#!/usr/bin/env bash
# Creates the daily production backup without restarting any containers.
set -euo pipefail

CRM_ENVIRONMENT=prod
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
# shellcheck source=database.sh
source "$APP_DIR/deploy/database.sh"
# shellcheck source=backup-retention.sh
source "$APP_DIR/deploy/backup-retention.sh"

# The existing production scripts use the same lock before the first Deploy prod.
exec 9>"$APP_DIR/operation.lock"
flock -w 3600 9 || fail "could not acquire the production operation lock"
check_restore_complete
check_env_file

APP_CONTAINER=$(APP_TAG=unreleased compose ps --all --quiet app)
APP_TAG=unreleased
if [ -n "$APP_CONTAINER" ]; then
  APP_TAG=$(container_app_tag "$APP_CONTAINER")
fi
export APP_TAG
DATABASE=$(database_name)
backup_database daily "$APP_TAG" "$DATABASE" >/dev/null
prune_backups daily
