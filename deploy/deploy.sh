#!/usr/bin/env bash
# Deploys an app image on the server. GitHub Actions runs it after pushing
# the image to GHCR:
#   deploy.sh <image tag> <ghcr user>    (GHCR token on stdin)
# Steps: pull the image -> migrations in a one-off container -> start the new
# image -> smoke /health -> keep only the current and previous images.
# No automatic rollback: on any error the script stops; a person decides
# whether to run rollback.sh.
set -euo pipefail

# shellcheck source=common.sh
source "$(dirname "$0")/common.sh"

TAG="${1:?usage: deploy.sh <image tag> <ghcr user>}"
GHCR_USER="${2:?usage: deploy.sh <image tag> <ghcr user>}"

check_env_file
touch "$RELEASE_FILE"
CURRENT=$(release_value APP_TAG)
PREVIOUS=$(release_value PREVIOUS_TAG)

log "Pull $IMAGE:$TAG"
# The token from GitHub Actions is valid only while the job runs
docker login ghcr.io -u "$GHCR_USER" --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null' EXIT
docker pull "$IMAGE:$TAG"

log "Database"
APP_TAG="$TAG" compose up -d --wait db

log "Migrations"
APP_TAG="$TAG" compose run --rm migrate ||
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
