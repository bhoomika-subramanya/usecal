import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, StickyNote, Highlighter, PenLine, Link2, Keyboard, Sparkles, Loader2, Tag, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  useCreateAnnotation,
  getListAnnotationsQueryKey,
  getGetAnnotationStatsQueryKey,
  getGetRecentAnnotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadImageFile, captureWebScreenshot } from "@/lib/media";

const typeConfig = {
  text: { icon: StickyNote, color: "#FACC15", label: "Text" },
  highlight: { icon: Highlighter, color: "#4ADE80", label: "Highlight" },
  drawing: { icon: PenLine, color: "#60A5FA", label: "Drawing" },
  link: { icon: Link2, color: "#C084FC", label: "Link" },
} as const;

type AnnotationType = keyof typeof typeConfig;

const formSchema = z.object({
  title: z.string().min(1, "Required"),
  content: z.string().min(1, "Required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function Popup() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<AnnotationType>("text");
  const [submitted, setSubmitted] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const qc = useQueryClient();
  const createAnnotation = useCreateAnnotation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", content: "" },
  });

  const typeColorMap: Record<AnnotationType, string> = {
    text: "#FACC15",
    highlight: "#4ADE80",
    drawing: "#60A5FA",
    link: "#C084FC",
  };

  const onSubmit = (values: FormValues) => {
    createAnnotation.mutate(
      {
        data: {
          title: values.title,
          content: values.content,
          type: selectedType,
          color: typeColorMap[selectedType],
          tags: tags,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAnnotationsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetAnnotationStatsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetRecentAnnotationsQueryKey() });
          setSubmitted(true);
          setTimeout(() => setLocation("/"), 1200);
        },
      }
    );
  };

  const handleClose = () => setLocation("/");

  const handleAutoTag = async () => {
    const content = form.getValues().content;
    if (!content) return;
    setIsAutoTagging(true);
    try {
      const res = await fetch("http://localhost:3001/api/ai/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to auto-tag");
      const data = await res.json();
      if (data.tags && Array.isArray(data.tags)) {
        setTags(prev => [...new Set([...prev, ...data.tags])]);
      }
    } catch (error) {
      console.error("Error auto-tagging:", error);
    } finally {
      setIsAutoTagging(false);
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().replace(/^,+|,+$/g, "");
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleImageUpload = async (file: File | Blob) => {
    try {
      const imgMarkdown = await uploadImageFile(file);
      const currentContent = form.getValues().content || "";
      form.setValue("content", currentContent + imgMarkdown, { shouldValidate: true });
    } catch (err) {
      console.error("Failed to upload image:", err);
    }
  };

  const handleScreenshot = async () => {
    try {
      const imgMarkdown = await captureWebScreenshot();
      const currentContent = form.getValues().content || "";
      form.setValue("content", currentContent + imgMarkdown, { shouldValidate: true });
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleImageUpload(file);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith("image/")) handleImageUpload(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
      data-testid="popup-backdrop"
    >
      {/* Hotkey hint banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-6 left-1/2 -translate-x-1/2"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-xs backdrop-blur-sm">
          <Keyboard className="w-3.5 h-3.5" />
          <span>Press</span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10px] text-white">
            Ctrl+Alt+L
          </kbd>
          <span>anywhere to open this popup system-wide (in Tauri desktop build)</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {submitted ? (
          <motion.div
            key="success"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <StickyNote className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-white text-sm font-medium">Annotation saved!</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ scale: 0.93, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-md mx-4 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
            style={{ background: "hsl(240 10% 8%)" }}
            data-testid="popup-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500/70" />
                <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
                <div className="w-2 h-2 rounded-full bg-green-500/70" />
                <span className="ml-2 text-xs font-medium text-white/50">Quick Annotate</span>
              </div>
              <button
                onClick={handleClose}
                className="text-white/40 hover:text-white/70 transition-colors"
                data-testid="button-close-popup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-1.5 px-4 pt-4">
              {(Object.entries(typeConfig) as [AnnotationType, typeof typeConfig[AnnotationType]][]).map(
                ([type, conf]) => {
                  const Icon = conf.icon;
                  const isSelected = selectedType === type;
                  return (
                    <button
                      type="button"
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border transition-all text-xs font-medium"
                      style={{
                        borderColor: isSelected ? conf.color + "66" : "rgba(255,255,255,0.08)",
                        backgroundColor: isSelected ? conf.color + "18" : "transparent",
                        color: isSelected ? conf.color : "rgba(255,255,255,0.4)",
                      }}
                      data-testid={`type-button-${type}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{conf.label}</span>
                    </button>
                  );
                }
              )}
            </div>

            {/* Form */}
            <div className="p-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Title..."
                            {...field}
                            autoFocus
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm focus:border-white/30"
                            data-testid="input-popup-title"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            placeholder="What do you want to note down?"
                            rows={4}
                            {...field}
                            onPaste={handlePaste}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm focus:border-white/30 resize-none"
                            data-testid="textarea-popup-content"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-3 border-b border-white/10">
                    <Tag className="w-3.5 h-3.5 text-white/50 shrink-0" />
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 text-[10px] py-0 pl-2 pr-1 cursor-default bg-white/10 hover:bg-white/10 text-white border-white/5"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setTags((p) => p.filter((t) => t !== tag))}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      type="text"
                      placeholder={tags.length === 0 ? "Add tags..." : ""}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="bg-transparent text-xs text-white placeholder:text-white/30 outline-none border-none min-w-[60px] flex-1"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-white/30 text-[10px] mr-2">
                        <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">ESC</kbd>
                        <span>close</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleScreenshot}
                        className="h-8 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Screenshot
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAutoTag}
                        disabled={isAutoTagging || !form.watch("content")}
                        className="h-8 gap-1.5 text-xs text-white/50 hover:text-white hover:bg-white/10"
                      >
                        {isAutoTagging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Auto-Tag
                      </Button>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={createAnnotation.isPending}
                      style={{
                        backgroundColor: typeColorMap[selectedType],
                        color: "#000",
                        border: "none",
                      }}
                      className="font-medium hover:opacity-90"
                      data-testid="button-popup-save"
                    >
                      Save
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
