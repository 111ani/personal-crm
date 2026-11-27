#!/usr/bin/env bash
# Selects the newest successful staging deployment built from main.
set -euo pipefail

REQUESTED_SHA=${1:-}
QUERY="repos/$GITHUB_REPOSITORY/deployments?environment=staging&ref=main&per_page=100"
if [ -n "$REQUESTED_SHA" ]; then
  [[ "$REQUESTED_SHA" =~ ^[a-f0-9]{40}$ ]] || {
    echo 'Enter the full 40-character commit SHA.' >&2
    exit 1
  }
  QUERY+="&sha=$REQUESTED_SHA"
fi

DEPLOYMENTS=$(gh api --paginate "$QUERY" --jq '.[] | [.id, .sha] | @tsv')
while IFS=$'\t' read -r id sha; do
  [ -n "$id" ] || continue
  # GitHub can mark a superseded deployment inactive after it succeeded.
  STATE=$(gh api --paginate "repos/$GITHUB_REPOSITORY/deployments/$id/statuses?per_page=100" \
    --jq '.[] | select(.state != "inactive") | .state' | sed -n '1p')
  if [ "$STATE" = success ]; then
    printf '%s\n' "$sha"
    exit 0
  fi
done <<<"$DEPLOYMENTS"

if [ -n "$REQUESTED_SHA" ]; then
  echo "SHA $REQUESTED_SHA has no successful staging deployment from main." >&2
else
  echo 'No successful staging deployment from main was found.' >&2
fi
exit 1
