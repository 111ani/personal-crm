#!/usr/bin/env bash
# Deploys an app image on the server. GitHub Actions runs it after pushing
# the image to GHCR:
#   deploy.sh <prod|staging> <image tag> <ghcr user>    (GHCR token on stdin)
# For a manual staging deploy, omit the GHCR user to use a local image.
set -euo pipefail

USAGE='usage: deploy.sh <prod|staging> <image tag> <ghcr user>'
CRM_ENVIRONMENT="${1:?$USAGE}"
TAG="${2:?$USAGE}"
GHCR_USER="${3:-}"

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"
# shellcheck source=database.sh
source "$APP_DIR/deploy/database.sh"

[ "$CRM_ENVIRONMENT" = staging ] || [ -n "$GHCR_USER" ] || fail "$USAGE"

lock_environment
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

if [ -n "$GHCR_USER" ]; then
  log "Pull $IMAGE:$TAG"
  # Each deploy gets its own credentials because prod and staging can overlap.
  registry_config=$(mktemp -d)
  trap 'rm -f -- "$registry_config/config.json"; rmdir -- "$registry_config"' EXIT
  docker --config "$registry_config" login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
  docker --config "$registry_config" pull "$IMAGE:$TAG"
else
  docker image inspect "$IMAGE:$TAG" >/dev/null ||
    fail "image $IMAGE:$TAG is not on the server"
fi
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
    if (new URL(process.env.BETTER_AUTH_URL).origin !== `https://${process.argv[1]}`) {
      throw new Error(`BETTER_AUTH_URL must use https://${process.argv[1]}`);
    }
  ' "$APP_HOST"
fi

DB_CONTAINER=$(compose ps --all --quiet db)
if [ "$CRM_ENVIRONMENT" = staging ]; then
  [ -n "$DB_CONTAINER" ] || fail "initialize the staging database from a production backup first"
fi
if [ -n "$DB_CONTAINER" ]; then
  # Start the existing database if needed without applying new configuration.
  compose start --wait --wait-timeout 90 db
  DATABASE=$(database_name)
  if [ "$CRM_ENVIRONMENT" = staging ] && [ "$(database_has_contacts "$DATABASE")" != t ]; then
    fail "initialize the staging database from a production backup first"
  fi
  DB_SCHEMA=$(database_schema "$DATABASE")
  if [ "$DB_SCHEMA" = owner-v1 ] && [ "$TARGET_SCHEMA" = legacy ]; then
    fail "a legacy image cannot run against an owner-scoped database; use the manual restore procedure"
  fi
  if [ "$CURRENT_SCHEMA" = legacy ] && [ "$TARGET_SCHEMA" = owner-v1 ] && [ -n "$APP_CONTAINER" ]; then
    log "Stop the app before the first sign-in migration"
    compose stop app
  fi
  if [ "$CRM_ENVIRONMENT" = prod ]; then
    log "Back up production database"
    BACKUP=$(backup_database deploy "${CURRENT:-unreleased}" "$DATABASE")
    if [ "$DB_SCHEMA" = legacy ] && [ "$TARGET_SCHEMA" = owner-v1 ] && [ -n "$CURRENT" ]; then
      # Keep the archive paired with the image that last wrote the legacy schema.
      (umask 077; printf '%s\n%s\n' "$CURRENT" "$BACKUP" >"$AUTH_BASELINE_FILE.tmp")
      mv "$AUTH_BASELINE_FILE.tmp" "$AUTH_BASELINE_FILE"
    fi
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

if [ "$CRM_ENVIRONMENT" = prod ]; then
  log "Clean up old images"
  STAGING_TAG=$(release_value APP_TAG "$ROOT_DIR/staging/release.env")
  CUTOFF=$(date -u -d '14 days ago' +%s)
  docker image ls --format '{{.Repository}}:{{.Tag}}' "$IMAGE" |
    while read -r image; do
      case "${image##*:}" in
        "$TAG" | "$PREVIOUS" | "$STAGING_TAG" | '<none>') continue ;;
      esac
      CREATED=$(docker image inspect --format '{{.Created}}' "$image")
      if [ "$(date -u -d "$CREATED" +%s)" -lt "$CUTOFF" ]; then
        docker image rm "$image" || echo "Could not remove $image, skipped"
      fi
    done
fi

log "Deployed $TAG to $CRM_ENVIRONMENT (previous: ${PREVIOUS:-none})"
