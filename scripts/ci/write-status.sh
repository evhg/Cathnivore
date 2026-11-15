#!/usr/bin/env bash
# Records one workflow's result for one commit on the ci-status branch: status/<name>.json.
# Usage: write-status.sh <name> <commit> <success|failure|cancelled>
# CI and E2E both write here and can finish together, so this never force-pushes: it rebuilds its commit on the
# latest ci-status and retries, so neither workflow's file can drop the other's.
set -euo pipefail
NAME=$1 COMMIT=$2 STATUS=$3
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
for attempt in 1 2 3 4 5 6; do
  if git fetch origin ci-status 2>/dev/null; then git checkout -q -B ci-status origin/ci-status; else git checkout -q --orphan ci-status; git rm -rq --cached . 2>/dev/null || true; fi
  mkdir -p status
  # Stop Vercel building this branch: status pushes were using up the Hobby plan's 100 deployments a day.
  printf '{"git":{"deploymentEnabled":false}}\n' > vercel.json
  cat > "status/$NAME.json" <<JSON
{
  "workflow": "$NAME",
  "commit": "$COMMIT",
  "success": $( [ "$STATUS" = "success" ] && echo true || echo false ),
  "time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
  # One file per commit as well (status/<name>/<sha>.json): a release tests a commit the lanes have often built past.
  mkdir -p "status/$NAME"
  cp "status/$NAME.json" "status/$NAME/$COMMIT.json"
  git add vercel.json "status/$NAME.json" "status/$NAME/$COMMIT.json"
  git commit -qm "$NAME status for $COMMIT" --allow-empty
  if git push -q origin ci-status; then exit 0; fi
  sleep $((attempt * 3))
done
echo "could not push ci-status" >&2
exit 1
