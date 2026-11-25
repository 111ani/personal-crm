# Shared by deploy.sh and restore.sh.

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
  log "Backup saved: $destination"
)
