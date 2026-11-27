#!/usr/bin/env bash
# Retain the ten newest SHA-tagged builds. Keep any other tags and attestations.
set -euo pipefail

PACKAGE="users/$GITHUB_REPOSITORY_OWNER/packages/container/personal-crm/versions"
VERSIONS=$(gh api --paginate --slurp "$PACKAGE?state=active&per_page=100")
OLD_IDS=$(jq -r '
  add
  | map(select(any((.metadata.container.tags // [])[]; test("^[a-f0-9]{40}$"))))
  | sort_by(.created_at, .id) | reverse
  | .[10:][]
  | select(all(.metadata.container.tags[]; test("^[a-f0-9]{40}$")))
  | .id
' <<<"$VERSIONS")

while IFS= read -r id; do
  [ -n "$id" ] || continue
  echo "Remove GHCR image version $id"
  gh api --method DELETE "$PACKAGE/$id" >/dev/null
done <<<"$OLD_IDS"
