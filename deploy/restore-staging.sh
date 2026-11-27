#!/usr/bin/env bash
# Manually initializes the separate staging database from a production backup.
set -euo pipefail

[ "$#" -eq 1 ] || { echo "Usage: restore-staging.sh <backup file>" >&2; exit 1; }
BACKUP_FILE=$(realpath -e -- "$1")

CRM_ENVIRONMENT=staging
# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
# shellcheck source=database.sh
source "$APP_DIR/deploy/database.sh"

case "$BACKUP_FILE" in
  "$ROOT_DIR"/backups/*.dump) ;;
  *) fail "choose an archive in $ROOT_DIR/backups" ;;
esac
[ -f "$BACKUP_FILE" ] && [ -r "$BACKUP_FILE" ] || fail "cannot read backup: $BACKUP_FILE"
[ -t 0 ] || fail "restore requires an interactive terminal"

lock_environment
check_env_file
touch "$RELEASE_FILE"
export APP_TAG=unreleased
[ -z "$(compose ps --all --quiet app)" ] || fail "a staging app container already exists"
compose up -d --wait --wait-timeout 90 db
DATABASE=$(database_name)
[ "$(db_exec psql -X --no-password --dbname="$DATABASE" --no-align --tuples-only --set=ON_ERROR_STOP=1 \
  --command="SELECT NOT EXISTS (SELECT FROM pg_class WHERE relnamespace IN (SELECT oid FROM pg_namespace WHERE nspname !~ '^(pg_|information_schema$)'))" </dev/null)" = t ] ||
  fail "the staging database is not empty"

CONTENTS=$(db_exec pg_restore --list <"$BACKUP_FILE")
grep -Eq '[[:space:]]TABLE[[:space:]]+public[[:space:]]+contacts[[:space:]]' <<<"$CONTENTS" ||
  fail "archive does not contain the CRM contacts table"

printf '\nBackup file: %s\nTarget database: %s (Docker Compose project staging)\n' "$BACKUP_FILE" "$DATABASE"
if ! read -r -p 'Type yes to load the backup into the empty staging database: ' confirmation || [ "$confirmation" != yes ]; then
  log "Restore cancelled"
  exit 0
fi

# Restore into an empty database in one transaction using the staging role.
db_exec pg_restore --no-password --single-transaction --no-owner --no-acl \
  --dbname="$DATABASE" <"$BACKUP_FILE" || fail "staging restore failed"
[ "$(database_has_contacts "$DATABASE")" = t ] || fail "archive did not contain the CRM contacts table"
log "Loaded the production backup into staging"
