#!/usr/bin/env bash
# Fails when a generated API artefact is out of step with the spec it comes from (D-062).
#
#   ai-service/openapi.json  -> backend/src/generated/ai-service.ts   (npm run gen:ai-types)
#   backend/openapi/openapi.yaml -> web/src/lib/api/schema.d.ts       (npm run gen:web-client)
#
# The ai-service snapshot itself is checked by ai-service/tests/test_openapi_snapshot.py,
# and the Express spec against the routes by backend's openapi-contract test.
# Run from the repo root after `npm ci` in backend/.
set -euo pipefail

cd "$(dirname "$0")/../.."
status=0

check() {
  local label="$1" file="$2" fix="$3"
  if ! git diff --quiet -- "$file"; then
    echo "::error file=$file::$label is stale. Run \`$fix\` and commit the result."
    git --no-pager diff --stat -- "$file"
    status=1
  else
    echo "ok: $label"
  fi
}

(cd backend && npm run --silent gen:ai-types >/dev/null)
check "backend/src/generated/ai-service.ts" backend/src/generated/ai-service.ts "cd backend && npm run gen:ai-types"

if [ -f web/src/lib/api/schema.d.ts ]; then
  (cd backend && npm run --silent gen:web-client >/dev/null)
  check "web/src/lib/api/schema.d.ts" web/src/lib/api/schema.d.ts "cd backend && npm run gen:web-client"
else
  echo "::notice::web/src/lib/api/schema.d.ts not generated yet (adopted in UI A); skipping the web client check."
fi

exit $status
