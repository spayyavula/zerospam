#!/usr/bin/env bash
# Render /data/app.env from SSM Parameter Store. Run on the host (cloud-init),
# not inside the container. Requires awscli v2 + jq and an instance role with
# ssm:GetParametersByPath on /zerospam/prod/*.
set -euo pipefail

PREFIX="${SSM_PREFIX:-/zerospam/prod}"
OUT="${1:-/data/app.env}"
REGION="${AWS_REGION:-us-east-1}"

tmp="$(mktemp)"
next=""
while :; do
  resp="$(aws ssm get-parameters-by-path \
    --path "$PREFIX" --with-decryption --recursive --region "$REGION" \
    ${next:+--next-token "$next"} --output json)"
  echo "$resp" | jq -r '.Parameters[] | "\(.Name | split("/") | last)=\(.Value)"' >> "$tmp"
  next="$(echo "$resp" | jq -r '.NextToken // empty')"
  [ -z "$next" ] && break
done

install -m 0600 "$tmp" "$OUT"
rm -f "$tmp"
echo "wrote $(wc -l < "$OUT") vars to $OUT"
