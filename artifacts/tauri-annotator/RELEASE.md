# Universal Annotator — Release Guide

> Version 1.0.0 | Tauri 2 + React + Vite

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Build locally (single platform)](#2-build-locally)
3. [Automated multi-platform build via GitHub Actions](#3-github-actions)
4. [Installer locations](#4-installer-locations)
5. [Testing the packaged app](#5-testing)
6. [Code signing](#6-code-signing)
7. [Custom icons](#7-custom-icons)
8. [Auto-updater (optional)](#8-auto-updater)

---

## 1. Prerequisites

### All platforms
| Tool | How to install |
|------|---------------|
| **Rust** (stable) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Node.js** 20+ | https://nodejs.org or `nvm install 20` |
| **pnpm** 10+ | `npm i -g pnpm` |
| **Tauri CLI** 2 | `cargo install tauri-cli --version "^2" --locked` |

### macOS only
Xcode Command Line Tools: `xcode-select --install`

### Linux (Ubuntu/Debian) only
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libxdo-dev \
  libxtst-dev
```

### Windows only
- Visual Studio 2019+ with the **Desktop development with C++** workload
- Or: `winget install Microsoft.VisualStudio.2022.BuildTools`

---

## 2. Build locally

From the repository root:

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/YOUR_ORG/universal-annotator.git
cd universal-annotator

# Install Node dependencies
pnpm install

# Generate placeholder icons (first time only)
node artifacts/tauri-annotator/scripts/generate-icons.cjs

# Build the frontend + Tauri bundle
bash artifacts/tauri-annotator/scripts/build.sh
```

The script builds for the current platform only. To cross-target (e.g. Apple Silicon
from an Intel Mac) pass the target flag:

```bash
cd artifacts/tauri-annotator
cargo tauri build --target aarch64-apple-darwin
```

---

## 3. GitHub Actions

Pushing a version tag triggers an automated build across all four platforms
(macOS arm64, macOS x64, Windows, Linux) and creates a draft GitHub Release.

```bash
# Update version in tauri.conf.json + Cargo.toml, commit, then:
git tag v1.0.0
git push origin v1.0.0
```

The workflow (`.github/workflows/release.yml`) will:
1. Build on `macos-latest`, `windows-latest`, and `ubuntu-22.04` in parallel
2. Run `generate-icons.cjs` automatically if icons are missing
3. Produce a draft release with all installers attached

You can also trigger a build manually from **Actions → Release → Run workflow**.

---

## 4. Installer locations

After a local build, installers appear in:

```
artifacts/tauri-annotator/src-tauri/target/release/bundle/
├── dmg/               ← macOS  (.dmg)
├── macos/             ← macOS  (.app bundle — for zip/notarization)
├── nsis/              ← Windows (.exe NSIS installer)
├── msi/               ← Windows (.msi — if enabled)
├── appimage/          ← Linux   (.AppImage — portable)
└── deb/               ← Linux   (.deb — Debian/Ubuntu)
```

---

## 5. Testing the packaged app

### macOS
1. Double-click the `.dmg` → drag **Universal Annotator.app** to Applications.
2. Launch from Applications — macOS Gatekeeper may show an unidentified-developer
   warning on unsigned builds: **right-click → Open** to bypass once.
3. The app icon appears in the **menu bar**. The app window is invisible until
   you press **⌘+Shift+L**.
4. Grant **Accessibility** permission when prompted (System Settings → Privacy &
   Security → Accessibility).
5. Test: open any app (e.g. Safari), press ⌘+Shift+L, verify the source app
   badge shows "Safari".

### Windows
1. Run the `.exe` installer → follow the NSIS wizard.
2. The app starts in the system tray (bottom-right taskbar area).
3. Press **Ctrl+Shift+L** to open the popup.
4. Test native tagging: paste a file path into the "Local file" field, add a tag,
   click **Apply Windows tag**, then open File Explorer → right-click the file →
   Properties → Details → check the **Tags** field.

### Linux
1. **AppImage**: `chmod +x Universal.Annotator_*.AppImage && ./Universal.Annotator_*.AppImage`
2. **deb**: `sudo dpkg -i universal-annotator_*_amd64.deb`
3. The app runs in the system tray (needs an AppIndicator-compatible DE such as
   GNOME with the AppIndicator extension, KDE, or XFCE).
4. Press **Ctrl+Shift+L** to open the popup.
5. Verify xattr tagging: `getfattr -n user.xdg.tags /path/to/file`

### Smoke-test checklist
- [ ] Global shortcut opens the popup from a different app
- [ ] Source app name and window title are detected correctly
- [ ] Annotation saves to the API server (visible on the Universal Annotator dashboard)
- [ ] Native OS tag is written to a test file and visible in Finder / File Explorer / `getfattr`
- [ ] Escape dismisses the popup; shortcut reopens it
- [ ] Tray icon menu → Show / Quit works

---

## 6. Code signing

Unsigned builds trigger OS security warnings. For production distribution:

### macOS (Notarization)
Add these secrets to your GitHub repository:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application: Name (TEAMID) |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-character team identifier |

### Windows (Authenticode)
Generate a self-signed certificate or purchase a code-signing cert, then:
```bash
cargo tauri signer generate -w .tauri/release.key
```
Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` to
your GitHub secrets.

---

## 7. Custom icons

Replace the auto-generated placeholder icons with your own brand art:

```bash
# Place your 1024×1024 PNG source image here:
cp my-brand-icon.png artifacts/tauri-annotator/src-tauri/icons/icon-source.png

# Let the Tauri CLI generate all required sizes automatically:
npx @tauri-apps/cli icon artifacts/tauri-annotator/src-tauri/icons/icon-source.png
```

This produces the correctly-sized PNG, ICO, and ICNS files in one command.

---

## 8. Auto-updater (optional)

Universal Annotator is ready to add Tauri's built-in updater plugin:

### 1. Add the plugin to Cargo.toml
```toml
[dependencies]
tauri-plugin-updater = "2"
```

### 2. Register in lib.rs
```rust
.plugin(tauri_plugin_updater::Builder::new().build())
```

### 3. Add to capabilities/default.json
```json
"updater:allow-check",
"updater:allow-download-and-install"
```

### 4. Add endpoint to tauri.conf.json (inside `"app"`)
```json
"updater": {
  "active": true,
  "endpoints": [
    "https://github.com/YOUR_ORG/universal-annotator/releases/latest/download/latest.json"
  ],
  "dialog": true
}
```

### 5. Generate signing key
```bash
cargo tauri signer generate -w .tauri/release.key
# → Outputs TAURI_SIGNING_PRIVATE_KEY — add to GitHub secrets
```

GitHub Actions will automatically sign each release with this key; the updater
client verifies signatures before installing.
