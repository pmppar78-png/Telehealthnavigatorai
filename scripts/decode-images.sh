#!/bin/sh
# Decode binary images committed as base64 (the GitHub connector cannot push binaries).
set -e
for f in scripts/*.webp.b64; do
  [ -e "$f" ] || continue
  out="images/guides/$(basename "$f" .b64)"
  base64 -d "$f" > "$out"
  echo "decoded $out"
done
