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

[ -f "$BACKUP_FILE" ] && [ -r "$BACKUP_FILE" ] || fail "cannot read backup: $BACKUP_FILE"
[ -t 0 ] || fail "restore requires an interactive terminal"
lock_production
check_env_file

# Compose needs an image tag to load the project even for read-only commands.
APP_CONTAINER=$(APP_TAG=unreleased compose ps --all --quiet app)
[ -n "$APP_CONTAINER" ] || fail "no production app container to restart after restore"
CURRENT=$(container_app_tag "$APP_CONTAINER")
export APP_TAG="$CURRENT"

DATABASE=$(database_name)
MAINTENANCE_DB=postgres
if [ "$DATABASE" = postgres ]; then
  MAINTENANCE_DB=template1
fi

log "Validate backup archive"
db_exec pg_restore --exit-on-error --file=/dev/null <"$BACKUP_FILE" ||
  fail "could not read the PostgreSQL backup: $BACKUP_FILE"

printf '\nBackup file: %s\nProduction database to replace: %s\nApp version: %s\n' \
  "$BACKUP_FILE" "$DATABASE" "$CURRENT"
if ! read -r -p 'Type yes to replace the database: ' CONFIRMATION || [ "$CONFIRMATION" != yes ]; then
  log "Restore cancelled"
  exit 0
fi

DATABASE_EXISTS=$(db_exec psql -X --no-password --dbname="$MAINTENANCE_DB" \
  --no-align --tuples-only --set=ON_ERROR_STOP=1 --set=target_db="$DATABASE" <<'SQL'
SELECT EXISTS (SELECT FROM pg_database WHERE datname = :'target_db');
SQL
)
case "$DATABASE_EXISTS" in
  t) backup_database before-restore "$CURRENT" "$DATABASE" ;;
  f) log "Database is already absent; there is nothing to back up" ;;
  *) fail "could not determine if database $DATABASE exists" ;;
esac

log "Stop production app"
compose stop app
touch "$RESTORE_PENDING"

log "Recreate database $DATABASE and restore backup"
db_exec dropdb --no-password --if-exists --maintenance-db="$MAINTENANCE_DB" -- "$DATABASE" ||
  fail "could not drop database $DATABASE; the app remains stopped"
db_exec createdb --no-password --maintenance-db="$MAINTENANCE_DB" --template=template0 -- "$DATABASE" ||
  fail "could not create database $DATABASE; the app remains stopped"
db_exec pg_restore --no-password --single-transaction --dbname="$DATABASE" <"$BACKUP_FILE" ||
  fail "restore failed; the app remains stopped"
rm -- "$RESTORE_PENDING"

log "Start the existing production app ($CURRENT)"
compose start --wait --wait-timeout 180 app ||
  fail "the app did not become healthy after restore. Logs: docker logs prod-app-1"
smoke_app "$CURRENT"
log "Restored $DATABASE from $BACKUP_FILE"
