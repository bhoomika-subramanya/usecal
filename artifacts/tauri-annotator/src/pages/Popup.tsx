import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil,
  Link,
  Highlighter,
  FileText,
  Camera,
  Tag,
  X,
  Send,
  Loader2,
  Monitor,
  Pin,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  AppWindow,
} from "lucide-react";
import { api, type Annotation, type CreateAnnotationBody } from "@/lib/api";
import {
  getActiveWindow,
  captureScreenshot,
  hideWindow,
  isTauri,
} from "@/lib/tauri";
import { useToast } from "@/hooks/use-toast";

type AnnotationType = "text" | "highlight" | "drawing" | "link";

const TYPE_CONFIG: Record<
  AnnotationType,
  { label: string; icon: React.ReactNode; color: string; accent: string }
> = {
  text: {
    label: "Note",
    icon: <FileText className="w-3.5 h-3.5" />,
    color: "#FACC15",
    accent: "rgb(250 204 21 / 0.15)",
  },
  highlight: {
    label: "Highlight",
    icon: <Highlighter className="w-3.5 h-3.5" />,
    color: "#4ADE80",
    accent: "rgb(74 222 128 / 0.15)",
  },
  drawing: {
    label: "Drawing",
    icon: <Pencil className="w-3.5 h-3.5" />,
    color: "#60A5FA",
    accent: "rgb(96 165 250 / 0.15)",
  },
  link: {
    label: "Link",
    icon: <Link className="w-3.5 h-3.5" />,
    color: "#C084FC",
    accent: "rgb(192 132 252 / 0.15)",
  },
};

function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function Popup() {
  const { toast } = useToast();
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const [type, setType] = useState<AnnotationType>("text");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [sourceApp, setSourceApp] = useState("");
  const [sourceWindowTitle, setSourceWindowTitle] = useState("");
  const [localFilePath, setLocalFilePath] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recentAnnotations, setRecentAnnotations] = useState<Annotation[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [isDetectingWindow, setIsDetectingWindow] = useState(true);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.focus();
    }
    loadActiveWindow();
    loadRecentAnnotations();
  }, []);

  async function loadActiveWindow() {
    setIsDetectingWindow(true);
    try {
      const info = await getActiveWindow();
      if (info) {
        setSourceApp(info.app);
        setSourceWindowTitle(info.title);
      } else if (!isTauri()) {
        setSourceApp("Browser");
        setSourceWindowTitle(document.title || "Web Preview");
      }
    } finally {
      setIsDetectingWindow(false);
    }
  }

  async function loadRecentAnnotations() {
    setIsLoadingRecent(true);
    try {
      const data = await api.annotations.list({ limit: 5 });
      setRecentAnnotations(data);
    } catch {
    } finally {
      setIsLoadingRecent(false);
    }
  }

  const handleScreenshot = useCallback(async () => {
    if (!isTauri()) {
      toast({
        title: "Desktop only",
        description: "Screenshot capture only works in the native desktop app.",
      });
      return;
    }
    const dataUrl = await captureScreenshot();
    if (dataUrl) {
      setScreenshot(dataUrl);
      toast({ title: "Screenshot captured" });
    } else {
      toast({ title: "Screenshot failed", variant: "destructive" });
    }
  }, [toast]);

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/,/g, "");
      if (tag && !tags.includes(tag)) {
        setTags((prev) => [...prev, tag]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      contentRef.current?.focus();
      return;
    }

    setIsSaving(true);
    try {
      const body: CreateAnnotationBody = {
        title: title.trim() || content.trim().slice(0, 60),
        content: content.trim(),
        type,
        color: TYPE_CONFIG[type].color,
        sourceApp: sourceApp || null,
        sourceWindowTitle: sourceWindowTitle || null,
        localFilePath: localFilePath.trim() || null,
        osTagsSynced: false,
        tags,
      };

      await api.annotations.create(body);
      setSaved(true);

      toast({
        title: "Annotation saved",
        description: sourceApp ? `Captured from ${sourceApp}` : "Saved successfully",
      });

      setTimeout(async () => {
        if (isTauri()) {
          await hideWindow();
        }
        resetForm();
        setSaved(false);
        await loadRecentAnnotations();
      }, 1200);
    } catch (e) {
      toast({
        title: "Failed to save",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  function resetForm() {
    setContent("");
    setTitle("");
    setTags([]);
    setTagInput("");
    setScreenshot(null);
    setLocalFilePath("");
    setType("text");
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      hideWindow();
    }
  };

  const cfg = TYPE_CONFIG[type];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.3)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-[540px] glass-panel rounded-2xl overflow-hidden"
        style={{
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: cfg.accent, border: `1px solid ${cfg.color}30` }}
            >
              {cfg.icon}
            </div>
            <span className="text-sm font-semibold text-foreground">
              Quick Annotate
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {(Object.keys(TYPE_CONFIG) as AnnotationType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`type-pill flex items-center gap-1.5 ${type === t ? "active" : ""}`}
                style={
                  type === t
                    ? {
                        background: TYPE_CONFIG[t].accent,
                        color: TYPE_CONFIG[t].color,
                        border: `1px solid ${TYPE_CONFIG[t].color}40`,
                      }
                    : {}
                }
              >
                {TYPE_CONFIG[t].icon}
                <span className="hidden sm:inline">{TYPE_CONFIG[t].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Source metadata strip */}
        <div className="px-5 pb-3">
          <div
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {isDetectingWindow ? (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />
            ) : (
              <AppWindow className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {sourceApp ? (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-md shrink-0"
                  style={{
                    background: `${cfg.color}20`,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}30`,
                  }}
                >
                  {sourceApp}
                </span>
              ) : null}
              {sourceWindowTitle ? (
                <span className="text-xs text-muted-foreground truncate">
                  {sourceWindowTitle}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground/40 italic">
                  {isDetectingWindow ? "Detecting active window…" : "No window detected"}
                </span>
              )}
            </div>
            <Monitor className="w-3 h-3 text-muted-foreground/40 shrink-0" />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 mx-5" />

        {/* Title */}
        <div className="px-5 pt-4">
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/50 outline-none border-none py-0 pb-2"
          />
        </div>

        {/* Content */}
        <div className="px-5 pb-3">
          <textarea
            ref={contentRef}
            rows={4}
            placeholder={
              type === "link"
                ? "Paste a URL or describe this link…"
                : type === "highlight"
                ? "Paste highlighted text here…"
                : "What would you like to annotate?"
            }
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none border-none leading-relaxed"
          />
        </div>

        {/* Screenshot preview */}
        <AnimatePresence>
          {screenshot && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-3"
            >
              <div className="relative rounded-lg overflow-hidden border border-border">
                <img
                  src={screenshot}
                  alt="Screenshot"
                  className="w-full max-h-36 object-cover"
                />
                <button
                  onClick={() => setScreenshot(null)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File path field */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
            <input
              type="text"
              placeholder="Local file or folder path (optional)"
              value={localFilePath}
              onChange={(e) => setLocalFilePath(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none border-none font-mono"
            />
            {localFilePath && (
              <button
                onClick={() => setLocalFilePath("")}
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="px-5 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {tags.map((tag) => (
              <span key={tag} className="tag-pill">
                {tag}
                <button
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  className="hover:text-destructive"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="Add tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none border-none min-w-[80px] flex-1"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 mx-5" />

        {/* Action bar */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <button
            onClick={handleScreenshot}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-secondary"
          >
            <Camera className="w-3.5 h-3.5" />
            Screenshot
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block opacity-60">
              ⌘↩ to save
            </span>
            <motion.button
              onClick={handleSave}
              disabled={isSaving || !content.trim()}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: saved
                  ? "rgb(74 222 128 / 0.2)"
                  : content.trim()
                  ? cfg.accent
                  : undefined,
                color: saved ? "#4ADE80" : content.trim() ? cfg.color : undefined,
                border: `1px solid ${saved ? "#4ADE80" : content.trim() ? cfg.color : "transparent"}30`,
              }}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {saved ? "Saved!" : "Save"}
            </motion.button>
          </div>
        </div>

        {/* Recent annotations */}
        <div className="h-px bg-border/50 mx-5" />
        <button
          onClick={() => setShowRecent((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="font-medium">Recent annotations</span>
          {showRecent ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        <AnimatePresence>
          {showRecent && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-1 max-h-52 overflow-y-auto">
                {isLoadingRecent ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : recentAnnotations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No annotations yet
                  </p>
                ) : (
                  recentAnnotations.map((a) => {
                    const typeCfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.text;
                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-secondary/60 transition-colors cursor-default"
                      >
                        <div
                          className="w-1 rounded-full shrink-0 mt-1.5"
                          style={{
                            height: "28px",
                            background: typeCfg.color,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-foreground truncate flex-1">
                              {a.title}
                            </p>
                            {a.isPinned && (
                              <Pin className="w-2.5 h-2.5 text-primary shrink-0" />
                            )}
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatRelativeTime(a.updatedAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {a.content}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {a.sourceApp && (
                              <span className="text-[10px] font-medium" style={{ color: typeCfg.color }}>
                                {a.sourceApp}
                              </span>
                            )}
                            {a.localFilePath && (
                              <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-[140px]">
                                {a.localFilePath.split("/").pop() || a.localFilePath}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
