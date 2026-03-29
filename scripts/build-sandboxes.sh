#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SANDBOX_DIR="$ROOT_DIR/docker/sandboxes"

SANDBOXES=(python c cpp java)

for lang in "${SANDBOXES[@]}"; do
  image="interviewforge-${lang}-sandbox:latest"
  context="$SANDBOX_DIR/${lang}-sandbox"
  echo "Building $image from $context ..."
  docker build -t "$image" "$context"
done

echo "All sandbox images built."
