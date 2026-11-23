#!/usr/bin/env bash
# Deploys an app image on the server. GitHub Actions runs it after pushing
# the image to GHCR:
#   deploy.sh <image tag> <ghcr user>    (GHCR token on stdin)
# Steps: back up the database -> pull the image -> migrations in a one-off
# container -> start the new image -> smoke /health -> clean up old images.
# No automatic rollback: on any error the script stops; a person decides
# whether to run rollback.sh.
set -euo pipefail

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
# shellcheck source=database.sh
source "$APP_DIR/deploy/database.sh"

TAG="${1:?usage: deploy.sh <image tag> <ghcr user>}"
GHCR_USER="${2:?usage: deploy.sh <image tag> <ghcr user>}"

lock_production
check_restore_complete
check_env_file
touch "$RELEASE_FILE"
CURRENT=$(release_value APP_TAG)
PREVIOUS=$(release_value PREVIOUS_TAG)
export APP_TAG="$TAG"

APP_CONTAINER=$(compose ps --all --quiet app)
if [ -n "$APP_CONTAINER" ]; then
  CURRENT=$(container_app_tag "$APP_CONTAINER")
fi

log "Back up production database"
DB_CONTAINER=$(compose ps --all --quiet db)
if [ -n "$DB_CONTAINER" ]; then
  # Start the existing database if needed without applying new configuration.
  compose start --wait --wait-timeout 90 db
  DATABASE=$(database_name)
  backup_database deploy "${CURRENT:-unreleased}" "$DATABASE"
else
  DB_VOLUME=$(docker volume ls -q --filter label=com.docker.compose.project=prod \
    --filter label=com.docker.compose.volume=db-data)
  if [ -n "$CURRENT" ] || [ -n "$DB_VOLUME" ]; then
    fail "production database container is missing; cannot back up the existing installation"
  fi
  log "No production database yet; skipping backup on the first deploy"
fi

log "Pull $IMAGE:$TAG"
# The token from GitHub Actions is valid only while the job runs
docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null' EXIT
docker pull "$IMAGE:$TAG"

log "Database"
compose up -d --wait db

log "Migrations"
compose run --rm migrate ||
  fail "migrations failed, the new image was not started. The current version keeps running"

log "Start $IMAGE:$TAG"
if [ -n "$CURRENT" ] && [ "$CURRENT" != "$TAG" ]; then
  PREVIOUS="$CURRENT"
fi
write_release "$TAG" "$PREVIOUS"
start_app "$TAG"

log "Clean up old images"
docker image ls --format '{{.Repository}}:{{.Tag}}' "$IMAGE" |
  while read -r image; do
    case "${image##*:}" in
      "$TAG" | "$PREVIOUS") ;;
      *) docker image rm "$image" || echo "Could not remove $image, skipped" ;;
    esac
  done

log "Deployed $TAG (previous: ${PREVIOUS:-none})"
