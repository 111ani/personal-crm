# Shared by deployment, restore and rollback.

BACKUP_DIR="$APP_DIR/backups"

db_exec() {
  compose exec -T db sh -ec '
    export PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"
    exec "$@"
  ' sh "$@"
}

database_name() {
  db_exec printenv POSTGRES_DB </dev/null
}

database_schema() {
  db_exec psql -X --no-password --dbname="$1" --no-align --tuples-only --set=ON_ERROR_STOP=1 \
    --command="SELECT CASE WHEN to_regclass('public.auth_user') IS NULL THEN 'legacy' ELSE 'owner-v1' END" </dev/null
}

backup_database() (
  local reason="$1" tag="$2" database="$3"
  local timestamp destination temporary

  umask 077
  install -d -m 700 "$BACKUP_DIR"
  timestamp=$(date -u +%Y%m%dT%H%M%S%NZ)
  destination="$BACKUP_DIR/$reason-$tag-$timestamp.dump"
  temporary=$(mktemp "$BACKUP_DIR/.backup-XXXXXXXX")
  trap 'rm -f -- "$temporary"' EXIT

  db_exec pg_dump --no-password --format=custom --dbname="$database" \
    </dev/null >"$temporary" || fail "backup of database $database failed"
  [ -s "$temporary" ] || fail "backup of database $database is empty"
  mv -T -- "$temporary" "$destination"
  log "Backup saved: $destination" >&2
  printf '%s\n' "$destination"
)

confirm_database_restore() {
  local backup="$1" database="$2" current="$3" target="$4"
  local confirmation contents backup_schema target_schema

  [ -f "$backup" ] && [ -r "$backup" ] || fail "cannot read backup: $backup"
  [ -t 0 ] || fail "restore requires an interactive terminal"
  target_schema=$(image_database_schema "$target") || fail "could not inspect image $target"
  log "Validate backup archive"
  db_exec pg_restore --exit-on-error --file=/dev/null <"$backup" || fail "could not read backup: $backup"
  contents=$(db_exec pg_restore --list <"$backup") || fail "could not list backup contents: $backup"
  backup_schema=legacy
  if grep -Eq '[[:space:]]TABLE[[:space:]]+public[[:space:]]+auth_user[[:space:]]' <<<"$contents"; then
    backup_schema=owner-v1
  fi
  [ "$backup_schema" = "$target_schema" ] || fail "the backup schema does not match image $target"

  printf '\nBackup file: %s\nProduction database to replace: %s\nApp version: %s\n' "$backup" "$database" "$current"
  if [ "$current" != "$target" ]; then
    printf 'App version after restore: %s\n' "$target"
  fi
  if ! read -r -p 'Type yes to replace the database: ' confirmation || [ "$confirmation" != yes ]; then
    log "Restore cancelled"
    return 1
  fi
}

restore_database() {
  local backup="$1" database="$2" current="$3"
  local maintenance_db=postgres database_exists
  if [ "$database" = postgres ]; then
    maintenance_db=template1
  fi

  database_exists=$(db_exec psql -X --no-password --dbname="$maintenance_db" \
    --no-align --tuples-only --set=ON_ERROR_STOP=1 --set=target_db="$database" <<'SQL'
SELECT EXISTS (SELECT FROM pg_database WHERE datname = :'target_db');
SQL
  )
  case "$database_exists" in
    t) backup_database before-restore "$current" "$database" >/dev/null ;;
    f) log "Database is already absent; there is nothing to back up" ;;
    *) fail "could not determine if database $database exists" ;;
  esac

  log "Stop production app"
  compose stop app
  touch "$RESTORE_PENDING"

  log "Recreate database $database and restore backup"
  db_exec dropdb --no-password --if-exists --maintenance-db="$maintenance_db" -- "$database" ||
    fail "could not drop database $database; the app remains stopped"
  db_exec createdb --no-password --maintenance-db="$maintenance_db" --template=template0 -- "$database" ||
    fail "could not create database $database; the app remains stopped"
  db_exec pg_restore --no-password --single-transaction --dbname="$database" <"$backup" ||
    fail "restore failed; the app remains stopped"
}
