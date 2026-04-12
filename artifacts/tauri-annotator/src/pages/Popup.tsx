import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Link2,
  Highlighter,
  FileText,
  Camera,
  X,
  Loader2,
  CheckCircle2,
  ChevronDown,
  FolderOpen,
  AppWindow,
  Tag,
  Pin,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type Annotation, type CreateAnnotationBody } from "@/lib/api";
import {
  getActiveWindow,
  captureScreenshot,
  hideWindow,
  isTauri,
  getPlatform,
  checkAccessibilityPermission,
  openAccessibilitySettings,
  listenPopupShown,
  writeNativeTag,
  type PopupShownPayload,
  type TagColor,
} from "@/lib/tauri";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────

type AnnotationType = "text" | "highlight" | "drawing" | "link";

const TYPES: {
  id: AnnotationType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}[] = [
  {
    id: "text",
    label: "Note",
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "#FACC15",
    bg: "rgba(250,204,21,0.12)",
  },
  {
    id: "highlight",
    label: "Highlight",
    icon: <Highlighter className="w-3.5 h-3.5" />,
    color: "#4ADE80",
    bg: "rgba(74,222,128,0.12)",
  },
  {
    id: "drawing",
    label: "Drawing",
    icon: <Pencil className="w-3.5 h-3.5" />,
    color: "#60A5FA",
    bg: "rgba(96,165,250,0.12)",
  },
  {
    id: "link",
    label: "Link",
    icon: <Link2 className="w-3.5 h-3.5" />,
    color: "#C084FC",
    bg: "rgba(192,132,252,0.12)",
  },
];

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Permission banner ────────────────────────────────────────────────────────

function AccessibilityBanner({
  onOpenSettings,
  onDismiss,
}: {
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-5 px-6 py-8 text-center"
      style={{ minHeight: "220px" }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.25)" }}
      >
        <ShieldAlert className="w-6 h-6" style={{ color: "#FACC15" }} />
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          Accessibility Permission Required
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[300px]">
          Universal Annotator needs Accessibility access to detect your active
          window and app context. Your data never leaves your device.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-[240px]">
        <Button
          onClick={onOpenSettings}
          size="sm"
          className="gap-1.5 text-xs font-semibold"
          style={{
            background: "rgba(250,204,21,0.15)",
            color: "#FACC15",
            border: "1px solid rgba(250,204,21,0.3)",
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open System Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Continue without permission
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground/40">
        After granting access, reopen the popup with Ctrl+Shift+L
      </p>
    </div>
  );
}

// ── Main popup ───────────────────────────────────────────────────────────────

export default function Popup() {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dismissedBtnRef = useRef<HTMLButtonElement>(null);

  const [type, setType] = useState<AnnotationType>("text");
  const [content, setContent] = useState("");
  const [localFilePath, setLocalFilePath] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [sourceApp, setSourceApp] = useState("");
  const [sourceWindowTitle, setSourceWindowTitle] = useState("");
  const [isDetecting, setIsDetecting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [recentList, setRecentList] = useState<Annotation[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const activeCfg = TYPES.find((t) => t.id === type)!;
  const platform = getPlatform();

  // ── Dismiss helper (works in both Tauri and web preview) ──────────────────

  const dismiss = useCallback(() => {
    if (isTauri()) {
      hideWindow();
    } else {
      setDismissed(true);
      // Immediately move focus to the dismissed button so the iframe keeps
      // keyboard focus — otherwise the browser shifts focus to the parent
      // document (Replit editor) and our keydown listeners stop firing.
      setTimeout(() => dismissedBtnRef.current?.focus(), 80);
    }
  }, []);

  const reopen = useCallback(() => {
    setDismissed(false);
    setTimeout(() => textareaRef.current?.focus(), 60);
  }, []);

  // ── Document-level Escape listener ────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape → dismiss
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      // Ctrl+Shift+L (or Cmd+Shift+L on macOS) → toggle popup
      // In the native desktop app this is handled by the Rust global shortcut;
      // this listener makes it work in the web preview too.
      const isToggle =
        (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l";
      if (isToggle) {
        e.preventDefault();
        if (dismissed) {
          reopen();
        } else {
          dismiss();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismiss, reopen, dismissed]);

  // ── Boot sequence ──────────────────────────────────────────────────────────

  useEffect(() => {
    // Auto-focus textarea immediately
    textareaRef.current?.focus();

    // Check macOS Accessibility permission
    if (platform === "macos" && isTauri()) {
      checkAccessibilityPermission().then((granted) => {
        if (!granted) setShowPermissionBanner(true);
      });
    }

    // Initial source window detection (for web preview fallback)
    if (!isTauri()) {
      setSourceApp("Browser");
      setSourceWindowTitle(document.title || "Tauri Annotator");
      setIsDetecting(false);
    } else {
      detectWindow();
    }

    fetchRecent();

    // Listen for `popup-shown` events emitted by Rust when the hotkey fires.
    // The payload contains the source window captured BEFORE our popup stole focus.
    let unlisten: (() => void) | null = null;
    listenPopupShown((payload: PopupShownPayload) => {
      applySourceInfo(payload);
      // Re-focus the textarea after a tick (window needs to be fully visible)
      setTimeout(() => textareaRef.current?.focus(), 80);
      // Refresh recent list on every open
      fetchRecent();
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function applySourceInfo(payload: PopupShownPayload) {
    if (payload.sourceApp != null) setSourceApp(payload.sourceApp);
    if (payload.sourceWindowTitle != null)
      setSourceWindowTitle(payload.sourceWindowTitle);
    setIsDetecting(false);
  }

  async function detectWindow() {
    setIsDetecting(true);
    try {
      const info = await getActiveWindow();
      if (info) {
        setSourceApp(info.app);
        setSourceWindowTitle(info.title);
      }
    } finally {
      setIsDetecting(false);
    }
  }

  async function fetchRecent() {
    setIsLoadingRecent(true);
    try {
      const data = await api.annotations.list({ limit: 6 });
      setRecentList(data);
    } catch {
      /* ignore */
    } finally {
      setIsLoadingRecent(false);
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleScreenshot = useCallback(async () => {
    if (!isTauri()) {
      toast({
        title: "Desktop only",
        description: "Screenshot capture requires the native desktop app.",
      });
      return;
    }
    const dataUrl = await captureScreenshot();
    if (dataUrl) {
      setScreenshot(dataUrl);
    } else {
      toast({ title: "Screenshot failed", variant: "destructive" });
    }
  }, [toast]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/,/g, "");
      if (tag && !tags.includes(tag)) setTags((p) => [...p, tag]);
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((p) => p.slice(0, -1));
    }
  };

  // Map annotation type → macOS Finder tag color
  const typeColorMap: Record<string, TagColor> = {
    text: "yellow",
    highlight: "green",
    drawing: "purple",
    link: "blue",
  };

  const handleSave = async () => {
    if (!content.trim()) {
      textareaRef.current?.focus();
      return;
    }
    setIsSaving(true);
    try {
      const trimmedPath = localFilePath.trim();
      const body: CreateAnnotationBody = {
        title: content.trim().slice(0, 80),
        content: content.trim(),
        type,
        color: activeCfg.color,
        sourceApp: sourceApp || null,
        sourceWindowTitle: sourceWindowTitle || null,
        localFilePath: trimmedPath || null,
        osTagsSynced: false,
        tags,
      };
      await api.annotations.create(body);

      setJustSaved(true);
      toast({
        title: "Annotation saved",
        description: sourceApp
          ? `Captured from ${sourceApp}`
          : "Saved successfully.",
      });

      // Write tags to the file/folder via native OS APIs (Tauri only)
      if (trimmedPath && tags.length > 0 && isTauri()) {
        const tagColor = typeColorMap[type] ?? null;
        // Fire-and-forget; report result after a short delay so the save
        // toast is seen first
        Promise.all(tags.map((t) => writeNativeTag(trimmedPath, t, tagColor))).then(
          (results) => {
            const errors = results.filter(Boolean) as string[];
            if (errors.length === 0) {
              toast({ title: "Native tag applied to file" });
            } else {
              toast({
                title: "Some native tags failed",
                description: errors.join("; "),
                variant: "destructive",
              });
            }
          },
        );
      }

      // Reset form after brief "saved" flash, keep popup open
      setTimeout(() => {
        resetForm();
        setJustSaved(false);
        fetchRecent();
        textareaRef.current?.focus();
      }, 900);
    } catch (err) {
      toast({
        title: "Failed to save",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  function resetForm() {
    setContent("");
    setLocalFilePath("");
    setTags([]);
    setTagInput("");
    setScreenshot(null);
    setType("text");
  }

  // Card-level keyboard handler (Escape is handled at document level)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  // Click the translucent backdrop to dismiss
  const handleBackdropClick = () => dismiss();

  const placeholder =
    type === "link"
      ? "Paste a URL or describe the link…"
      : type === "highlight"
      ? "Paste the highlighted text here…"
      : type === "drawing"
      ? "Describe the drawing or sketch…"
      : "What would you like to annotate?";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "transparent" }}
      onClick={handleBackdropClick}
    >
      <AnimatePresence mode="wait">
        {dismissed ? (
          /* Web-preview dismissed state — auto-focused so keyboard keeps working */
          <motion.button
            key="dismissed"
            ref={dismissedBtnRef}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => { e.stopPropagation(); reopen(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reopen(); }
              if (e.key === "Escape") { e.preventDefault(); /* already dismissed */ }
            }}
            className="outline-none focus:outline-none glass-panel rounded-2xl px-8 py-5 flex flex-col items-center gap-3 cursor-pointer group"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 12px 40px rgba(0,0,0,0.6)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.2)", color: "#FACC15" }}
            >
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground group-hover:text-white transition-colors">
                Quick Annotate
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>Ctrl+Shift+L</kbd> or click to open
              </p>
            </div>
          </motion.button>
        ) : (
      <motion.div
        key="popup"
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -6 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[520px] rounded-2xl overflow-hidden glass-panel"
        style={{
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.07), 0 28px 72px rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.5)",
        }}
        // Stop backdrop click from propagating into the card
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ── Accessibility permission banner (macOS only) ───────────── */}
        <AnimatePresence>
          {showPermissionBanner && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AccessibilityBanner
                onOpenSettings={async () => {
                  await openAccessibilitySettings();
                }}
                onDismiss={() => setShowPermissionBanner(false)}
              />
              <Separator className="opacity-40" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-4">
          <motion.div
            key={type}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: activeCfg.bg,
              border: `1px solid ${activeCfg.color}28`,
              color: activeCfg.color,
            }}
          >
            {activeCfg.icon}
          </motion.div>

          <p className="text-[13px] font-semibold text-foreground shrink-0">
            Quick Annotate
          </p>

          {/* Type selector pills */}
          <div className="flex items-center gap-1 ml-auto">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                title={t.label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer"
                style={
                  type === t.id
                    ? {
                        background: t.bg,
                        color: t.color,
                        border: `1px solid ${t.color}35`,
                      }
                    : {
                        color: "hsl(var(--muted-foreground))",
                        border: "1px solid transparent",
                      }
                }
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Source strip ─────────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {isDetecting ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 animate-spin" />
            ) : (
              <AppWindow className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            )}

            <div className="flex items-center gap-2 min-w-0 flex-1">
              {sourceApp && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{
                    background: `${activeCfg.color}18`,
                    color: activeCfg.color,
                    border: `1px solid ${activeCfg.color}28`,
                  }}
                >
                  {sourceApp}
                </span>
              )}
              <span className="text-xs text-muted-foreground truncate">
                {isDetecting
                  ? "Detecting active window…"
                  : sourceWindowTitle || "No window detected"}
              </span>
            </div>

            <span className="text-[10px] text-muted-foreground/30 shrink-0 font-medium uppercase tracking-wider">
              source
            </span>
          </div>
        </div>

        <Separator className="mx-5 w-auto opacity-40" />

        {/* ── Content textarea ─────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3">
          <Textarea
            ref={textareaRef}
            rows={6}
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="resize-none bg-transparent border-none shadow-none outline-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm leading-relaxed placeholder:text-muted-foreground/40 p-0 min-h-0"
          />
        </div>

        {/* ── Screenshot preview ───────────────────────────────────────── */}
        <AnimatePresence>
          {screenshot && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-3"
            >
              <div className="relative rounded-xl overflow-hidden border border-border/60">
                <img
                  src={screenshot}
                  alt="Captured screenshot"
                  className="w-full max-h-40 object-cover"
                />
                <button
                  onClick={() => setScreenshot(null)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── File path ────────────────────────────────────────────────── */}
        <div className="px-5 pb-3">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.055)",
            }}
          >
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <input
              type="text"
              placeholder="Local file or folder path (optional)"
              value={localFilePath}
              onChange={(e) => setLocalFilePath(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/35 outline-none border-none font-mono min-w-0"
            />
            {localFilePath && (
              <button
                onClick={() => setLocalFilePath("")}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* "Tag this file" quick-action (Tauri only, needs path + tags) */}
          {isTauri() && localFilePath.trim() && tags.length > 0 && (
            <button
              onClick={async () => {
                const tagColor = typeColorMap[type] ?? null;
                const results = await Promise.all(
                  tags.map((t) => writeNativeTag(localFilePath.trim(), t, tagColor)),
                );
                const errors = results.filter(Boolean) as string[];
                if (errors.length === 0) {
                  toast({ title: "Native tag applied to file" });
                } else {
                  toast({
                    title: "Some native tags failed",
                    description: errors.join("; "),
                    variant: "destructive",
                  });
                }
              }}
              className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium transition-colors"
              style={{ color: "rgba(250,204,21,0.7)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "rgba(250,204,21,1)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "rgba(250,204,21,0.7)")
              }
            >
              <Tag className="w-3 h-3" />
              Tag this file/folder now
            </button>
          )}
        </div>

        {/* ── Tags ─────────────────────────────────────────────────────── */}
        <div className="px-5 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="gap-1 text-xs py-0.5 pl-2 pr-1 cursor-default"
              >
                {tag}
                <button
                  onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            ))}
            <input
              type="text"
              placeholder={tags.length === 0 ? "Add tags…" : ""}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none border-none min-w-[60px] flex-1"
            />
          </div>
        </div>

        <Separator className="mx-5 w-auto opacity-40" />

        {/* ── Action bar ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleScreenshot}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Camera className="w-3.5 h-3.5" />
            {screenshot ? "Retake" : "Screenshot"}
          </Button>

          <div className="flex items-center gap-2.5">
            {/* Platform-appropriate shortcut hint */}
            <span className="text-[11px] text-muted-foreground/40 hidden sm:block">
              {platform === "macos" ? "⌘↩" : "Ctrl+↩"} to save
            </span>

            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                onClick={handleSave}
                disabled={isSaving || !content.trim()}
                size="sm"
                className="h-8 px-4 text-xs font-semibold gap-1.5 transition-all"
                style={
                  justSaved
                    ? {
                        background: "rgba(74,222,128,0.18)",
                        color: "#4ADE80",
                        border: "1px solid rgba(74,222,128,0.3)",
                      }
                    : content.trim()
                    ? {
                        background: activeCfg.bg,
                        color: activeCfg.color,
                        border: `1px solid ${activeCfg.color}35`,
                      }
                    : {}
                }
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : justSaved ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 opacity-70" />
                )}
                {isSaving ? "Saving…" : justSaved ? "Saved!" : "Save Annotation"}
              </Button>
            </motion.div>
          </div>
        </div>

        {/* ── Recent annotations ───────────────────────────────────────── */}
        <Separator className="mx-5 w-auto opacity-40" />
        <button
          onClick={() => setShowRecent((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-medium">Recent annotations</span>
          <motion.span
            animate={{ rotate: showRecent ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.span>
        </button>

        <AnimatePresence>
          {showRecent && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ScrollArea className="max-h-48">
                <div className="px-3 pb-3 space-y-0.5">
                  {isLoadingRecent ? (
                    <div className="flex justify-center py-5">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentList.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 text-center py-5">
                      No annotations yet
                    </p>
                  ) : (
                    recentList.map((a) => {
                      const cfg = TYPES.find((t) => t.id === a.type) ?? TYPES[0];
                      return (
                        <div
                          key={a.id}
                          className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors cursor-default"
                        >
                          <div
                            className="w-0.5 rounded-full shrink-0 self-stretch mt-0.5"
                            style={{
                              background: cfg.color,
                              minHeight: "28px",
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-xs font-medium text-foreground truncate flex-1">
                                {a.title}
                              </p>
                              {a.isPinned && (
                                <Pin className="w-2.5 h-2.5 text-primary/70 shrink-0" />
                              )}
                              <span className="text-[10px] text-muted-foreground/50 shrink-0">
                                {relTime(a.updatedAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground/70 truncate leading-relaxed">
                              {a.content}
                            </p>
                            {(a.sourceApp || a.localFilePath) && (
                              <div className="flex items-center gap-2 mt-0.5">
                                {a.sourceApp && (
                                  <span
                                    className="text-[10px] font-semibold"
                                    style={{ color: cfg.color }}
                                  >
                                    {a.sourceApp}
                                  </span>
                                )}
                                {a.localFilePath && (
                                  <span className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-[130px]">
                                    {a.localFilePath.split(/[\\/]/).pop()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
