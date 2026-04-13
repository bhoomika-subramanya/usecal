#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/build.sh  —  Local release build for Universal Annotator
#
# Run from the repo root or the artifacts/tauri-annotator directory:
#   bash artifacts/tauri-annotator/scripts/build.sh
#
# Prerequisites (install once):
#   Rust:   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
#   Tauri:  cargo install tauri-cli --version "^2"
#
# Linux extra deps:
#   sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \
#                           librsvg2-dev patchelf libxdo-dev libxtst-dev
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$TAURI_DIR/../.." && pwd)"
BUNDLE_DIR="$TAURI_DIR/src-tauri/target/release/bundle"

print_step() { echo; echo "▸ $*"; echo; }

# ── 1. Check tools ───────────────────────────────────────────────────────────
print_step "Checking prerequisites…"

for cmd in node pnpm cargo; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "✗  '$cmd' not found. Install it and re-run."
    exit 1
  fi
done

if ! cargo tauri --version &>/dev/null 2>&1; then
  echo "  Installing tauri-cli…"
  cargo install tauri-cli --version "^2" --locked
fi

# ── 2. Install Node deps ─────────────────────────────────────────────────────
print_step "Installing Node dependencies…"
cd "$ROOT_DIR"
pnpm install

# ── 3. Generate icons (idempotent) ───────────────────────────────────────────
if [ ! -f "$TAURI_DIR/src-tauri/icons/icon.icns" ]; then
  print_step "Generating icons…"
  node "$TAURI_DIR/scripts/generate-icons.cjs"
else
  echo "  Icons already present — skipping. Delete src-tauri/icons/ to regenerate."
fi

# ── 4. Build frontend ────────────────────────────────────────────────────────
print_step "Building React frontend…"
cd "$TAURI_DIR"
pnpm run build

# ── 5. Tauri build ───────────────────────────────────────────────────────────
print_step "Running tauri build…"
cd "$TAURI_DIR"
cargo tauri build

# ── 6. Show output ───────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════"
echo "  Build complete!"
echo "  Installers → $BUNDLE_DIR"
echo "═══════════════════════════════════════════════════════"
echo

if [[ "$(uname)" == "Darwin" ]]; then
  echo "macOS outputs:"
  ls "$BUNDLE_DIR/dmg/"   2>/dev/null && echo "  DMG:  $BUNDLE_DIR/dmg/"   || true
  ls "$BUNDLE_DIR/macos/" 2>/dev/null && echo "  .app: $BUNDLE_DIR/macos/" || true
elif [[ "$(uname)" == "Linux" ]]; then
  echo "Linux outputs:"
  ls "$BUNDLE_DIR/appimage/" 2>/dev/null && echo "  AppImage: $BUNDLE_DIR/appimage/" || true
  ls "$BUNDLE_DIR/deb/"      2>/dev/null && echo "  .deb:     $BUNDLE_DIR/deb/"      || true
fi
