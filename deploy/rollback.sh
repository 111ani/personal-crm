#!/usr/bin/env bash
# Returns the previous app image. Only a person runs it, never the pipeline:
#   sudo -u app-deploy bash /srv/personal-crm/deploy/rollback.sh
# Migrations are not reverted: the previous image runs on the current schema.
set -euo pipefail

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

check_env_file
CURRENT=$(release_value APP_TAG)
PREVIOUS=$(release_value PREVIOUS_TAG)
[ -n "$PREVIOUS" ] || fail "no previous version in $RELEASE_FILE"
docker image inspect "$IMAGE:$PREVIOUS" >/dev/null 2>&1 ||
  fail "image $IMAGE:$PREVIOUS is not on the server"

log "Roll back from $CURRENT to $PREVIOUS"
write_release "$PREVIOUS" "$CURRENT"
start_app "$PREVIOUS"

log "Rolled back to $PREVIOUS. To return, run this script again"
