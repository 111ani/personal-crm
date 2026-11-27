# Sourced by the production backup and deploy scripts.

prune_backups() {
  local reason="$1" old baseline=
  if [ "$reason" = deploy ] && [ -r "$AUTH_BASELINE_FILE" ]; then
    baseline=$(sed -n '2p' "$AUTH_BASELINE_FILE")
  fi
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "$reason-*.dump" -printf '%T@ %p\0' |
    sort -z -nr | tail -z -n +8 | cut -z -d ' ' -f 2- |
    while IFS= read -r -d '' old; do
      # The one-time sign-in migration archive is also used by legacy recovery.
      [ "$old" = "$baseline" ] && continue
      rm -- "$old"
      log "Removed old backup: $old"
    done
}
