#!/usr/bin/env bash
# Smoke-test the production images: contents first, then each one boots and answers.
#
# Run by the `docker` job in .github/workflows/ci.yml after it builds the images,
# and runnable locally against images built the same way:
#
#   for s in backend ai-service code-runner web; do
#     docker build -f $s/Dockerfile.prod -t interviewforge-$s:ci $s
#   done
#   bash scripts/ci/smoke_prod_images.sh
#
# Each service boots with no database, vector store or API keys. The point is that
# the image is complete and starts, not that the stack works (verify_*.py do that).
set -uo pipefail

TAG="${IMAGE_TAG:-ci}"
failures=0

pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; failures=$((failures + 1)); }

img() { echo "interviewforge-$1:$TAG"; }

# Run a shell snippet inside an image, bypassing its CMD.
in_image() { docker run --rm --entrypoint sh "$(img "$1")" -c "$2"; }

# Every check below reads as "the image is wrong" when it fails, so a missing image
# would produce a page of misleading failures. Stop instead.
for svc in backend ai-service code-runner web; do
  if ! docker image inspect "$(img "$svc")" >/dev/null 2>&1; then
    echo "ERROR: image $(img "$svc") not found -- build it first (see the header)."
    exit 2
  fi
done

# --- Contents ---------------------------------------------------------------

# No image may carry a .env: runtime config comes from env_file. The ai-service
# image used to ship its provider API keys this way (D-054).
for svc in backend ai-service code-runner web; do
  if in_image "$svc" 'test ! -e /app/.env'; then
    pass "$svc: no /app/.env in image"
  else
    fail "$svc: /app/.env is baked into the image"
  fi
done

# The seed script reads these from the image. A missing editorials file used to be
# silent: it seeded all 150 problems with no editorial (D-054).
for f in leetcode_problems.json problem_hints.json problem_editorials.json starter_templates.json; do
  if in_image backend "test -s /app/$f"; then
    pass "backend: $f present"
  else
    fail "backend: $f missing from image"
  fi
done

for f in tests .pytest_cache .corpus_cache; do
  if in_image ai-service "test ! -e /app/$f"; then
    pass "ai-service: $f excluded"
  else
    fail "ai-service: $f is in the image"
  fi
done

# --- Boot -------------------------------------------------------------------

# boot <service> <container-port> <url-path> [docker run args...]
boot() {
  local svc=$1 port=$2 url_path=$3
  shift 3
  local name="smoke-$svc" code="" i
  docker rm -f "$name" >/dev/null 2>&1
  if ! docker run -d --name "$name" -p "127.0.0.1::$port" "$@" "$(img "$svc")" >/dev/null; then
    fail "$svc: container failed to start"
    return
  fi
  local host_port
  host_port=$(docker port "$name" "$port/tcp" | head -n1 | awk -F: '{print $NF}')
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${host_port}${url_path}" || true)
    [ "$code" = "200" ] && break
    # Exited already: waiting out the full minute would only hide the reason.
    [ "$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)" = "true" ] || break
    sleep 1
  done
  if [ "$code" = "200" ]; then
    pass "$svc: GET $url_path -> 200 after ${i}s"
  else
    fail "$svc: GET $url_path -> '${code}' after ${i}s"
    docker logs "$name" 2>&1 | tail -n 20
  fi
  docker rm -f "$name" >/dev/null 2>&1
}

boot backend 4000 /health -e JWT_SECRET="$(openssl rand -hex 32)"
boot ai-service 8000 /health
boot code-runner 5000 /health
boot web 3000 /

# D-053: the backend must refuse to start without a signing secret, not fall back.
docker run --rm "$(img backend)" >/dev/null 2>&1
status=$?
if [ "$status" = "1" ]; then
  pass "backend: exits 1 with no JWT_SECRET"
else
  fail "backend: exit status $status with no JWT_SECRET (expected 1)"
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "RESULT: $failures check(s) failed"
  exit 1
fi
echo "RESULT: all checks passed"
