#!/usr/bin/env bash
# Compile the Kimi sidecar to standalone binaries via Bun. Output goes to
# server/dist/. The Tauri shell pulls these in via tauri.conf.json's
# externalBin, one per platform/arch.
#
# Why externalize ffmpeg-static: soundcloud.ts has it as a peer dep but
# only invokes it on the HLS code path, which we don't take ('progressive'
# format works for SC). Bundling it would add ~80MB per platform binary.
#
# Run prerequisites:
#   - Bun >= 1.3 in PATH (~/.bun/bin/bun if installed via the official script)
#   - cd server && npm install (dependencies must be on disk for bun bundle)

set -euo pipefail
cd "$(dirname "$0")"

OUT=./dist
mkdir -p "$OUT"

# Bun binary (allow override for CI / system path)
BUN="${BUN:-$HOME/.bun/bin/bun}"
if ! command -v "$BUN" >/dev/null 2>&1; then
  echo "ERROR: bun not found at $BUN. Install via 'curl https://bun.sh/install | bash'."
  exit 1
fi

build_target() {
  local target="$1" outname="$2"
  echo "== Building $outname for $target =="
  "$BUN" build --compile \
    --target="$target" \
    --external ffmpeg-static \
    ./index.js \
    --outfile="$OUT/$outname"
  ls -lh "$OUT/$outname" | awk '{print "  size:", $5}'
}

build_target bun-darwin-arm64  kimi-server-darwin-arm64
build_target bun-darwin-x64    kimi-server-darwin-x64
build_target bun-windows-x64   kimi-server-windows-x64.exe
build_target bun-linux-x64     kimi-server-linux-x64

echo ""
echo "Done. Binaries in $OUT/"
