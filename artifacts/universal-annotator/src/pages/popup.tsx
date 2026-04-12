import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, StickyNote, Highlighter, PenLine, Link2, Keyboard } from "lucide-react";
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
          tags: [],
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
            Ctrl+Shift+A
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
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/30 text-sm focus:border-white/30 resize-none"
                            data-testid="textarea-popup-content"
                          />
                        </FormControl>
                        <FormMessage className="text-red-400 text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-white/30 text-[10px]">
                      <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">ESC</kbd>
                      <span>close</span>
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
