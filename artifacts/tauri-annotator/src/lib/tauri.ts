export interface ActiveWindowInfo {
  app: string;
  title: string;
}

export interface PopupShownPayload {
  sourceApp: string | null;
  sourceWindowTitle: string | null;
}

// ── Environment detection ────────────────────────────────────────────────────

let _isTauri: boolean | null = null;

export function isTauri(): boolean {
  if (_isTauri === null) {
    _isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  }
  return _isTauri;
}

/** Detects the current OS. Works in both Tauri and browser contexts. */
export function getPlatform(): "macos" | "windows" | "linux" | "web" {
  if (!isTauri()) return "web";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac os")) return "macos";
  if (ua.includes("windows")) return "windows";
  return "linux";
}

// ── Window info ──────────────────────────────────────────────────────────────

export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<ActiveWindowInfo>("get_active_window");
    return result;
  } catch {
    return null;
  }
}

// ── Window management ────────────────────────────────────────────────────────

export async function hideWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch {}
}

/** Listen for the `popup-shown` event emitted by Rust when the popup is opened.
 *  Returns an unlisten function to clean up the listener. */
export async function listenPopupShown(
  callback: (payload: PopupShownPayload) => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<PopupShownPayload>("popup-shown", (event) => {
      callback(event.payload);
    });
    return unlisten;
  } catch {
    return () => {};
  }
}

// ── Screenshot ───────────────────────────────────────────────────────────────

export async function captureScreenshot(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const dataUrl = await invoke<string>("capture_screenshot");
    return dataUrl;
  } catch {
    return null;
  }
}

// ── Accessibility permission (macOS) ─────────────────────────────────────────

/** Returns true if Accessibility permission is granted (always true on non-macOS). */
export async function checkAccessibilityPermission(): Promise<boolean> {
  if (!isTauri()) return true;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("check_accessibility_permission");
  } catch {
    return true; // Assume granted if the command isn't available
  }
}

/** Opens System Settings → Privacy & Security → Accessibility. */
export async function openAccessibilitySettings(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_accessibility_settings");
  } catch {}
}

// ── Global shortcut (frontend registration — used as a fallback) ─────────────

export async function registerGlobalShortcut(
  shortcut: string,
  handler: () => void,
): Promise<void> {
  if (!isTauri()) return;
  try {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");
    await register(shortcut, handler);
  } catch {}
}
