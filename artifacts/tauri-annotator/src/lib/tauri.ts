export interface ActiveWindowInfo {
  app: string;
  title: string;
}

let _isTauri: boolean | null = null;

export function isTauri(): boolean {
  if (_isTauri === null) {
    _isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  }
  return _isTauri;
}

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

export async function captureScreenshot(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const dataUrl = await invoke<string>("capture_screenshot");
    return dataUrl;
  } catch (e) {
    console.warn("Screenshot capture failed", e);
    return null;
  }
}

export async function hideWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch {}
}

export async function registerGlobalShortcut(
  shortcut: string,
  handler: () => void,
): Promise<void> {
  if (!isTauri()) return;
  try {
    const { register } = await import("@tauri-apps/plugin-global-shortcut");
    await register(shortcut, handler);
  } catch (e) {
    console.warn("Could not register global shortcut", e);
  }
}
