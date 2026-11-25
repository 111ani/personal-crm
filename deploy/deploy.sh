#!/usr/bin/env bash
# Deploys an app image on the server. GitHub Actions runs it after pushing
# the image to GHCR:
#   deploy.sh <image tag> <ghcr user>    (GHCR token on stdin)
# Steps: pull the image -> back up the database -> migrations in a one-off
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

log "Pull $IMAGE:$TAG"
# The token from GitHub Actions is valid only while the job runs
docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null' EXIT
docker pull "$IMAGE:$TAG"
TARGET_SCHEMA=$(image_database_schema "$TAG")
CURRENT_SCHEMA=legacy
if [ -n "$CURRENT" ]; then
  CURRENT_SCHEMA=$(image_database_schema "$CURRENT")
fi

if [ "$TARGET_SCHEMA" = owner-v1 ]; then
  log "Check sign-in settings"
  compose run --rm --no-deps -T app node -e '
    for (const name of ["BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"]) {
      if (!process.env[name]?.trim()) throw new Error(`${name} is required to deploy sign-in`);
    }
    if (new URL(process.env.BETTER_AUTH_URL).protocol !== "https:") {
      throw new Error("BETTER_AUTH_URL must use HTTPS");
    }
  '
fi

DB_CONTAINER=$(compose ps --all --quiet db)
if [ -n "$DB_CONTAINER" ]; then
  # Start the existing database if needed without applying new configuration.
  compose start --wait --wait-timeout 90 db
  DATABASE=$(database_name)
  DB_SCHEMA=$(database_schema "$DATABASE")
  if [ "$DB_SCHEMA" = owner-v1 ] && [ "$TARGET_SCHEMA" = legacy ]; then
    fail "a legacy image cannot run against an owner-scoped database; use the manual restore procedure"
  fi
  if [ "$CURRENT_SCHEMA" = legacy ] && [ "$TARGET_SCHEMA" = owner-v1 ] && [ -n "$APP_CONTAINER" ]; then
    log "Stop the app before the first sign-in migration"
    compose stop app
  fi
  log "Back up production database"
  BACKUP=$(backup_database deploy "${CURRENT:-unreleased}" "$DATABASE")
  if [ "$DB_SCHEMA" = legacy ] && [ "$TARGET_SCHEMA" = owner-v1 ] && [ -n "$CURRENT" ]; then
    # Keep the archive paired with the image that last wrote the legacy schema.
    (umask 077; printf '%s\n%s\n' "$CURRENT" "$BACKUP" >"$AUTH_BASELINE_FILE.tmp")
    mv "$AUTH_BASELINE_FILE.tmp" "$AUTH_BASELINE_FILE"
  fi
else
  DB_VOLUME=$(docker volume ls -q --filter label=com.docker.compose.project=prod \
    --filter label=com.docker.compose.volume=db-data)
  if [ -n "$CURRENT" ] || [ -n "$DB_VOLUME" ]; then
    fail "production database container is missing; cannot back up the existing installation"
  fi
  log "No production database yet; skipping backup on the first deploy"
fi

log "Database"
compose up -d --wait db

log "Migrations"
compose run --rm migrate ||
  fail "migrations failed, the new image was not started"

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
