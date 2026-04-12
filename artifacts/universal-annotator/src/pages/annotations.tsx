import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  StickyNote,
  Highlighter,
  PenLine,
  Link2,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useListAnnotations,
  useDeleteAnnotation,
  useToggleAnnotationPin,
  getListAnnotationsQueryKey,
} from "@workspace/api-client-react";
import type { Annotation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const typeConfig = {
  text: { icon: StickyNote, color: "#FACC15", label: "Text" },
  highlight: { icon: Highlighter, color: "#4ADE80", label: "Highlight" },
  drawing: { icon: PenLine, color: "#60A5FA", label: "Drawing" },
  link: { icon: Link2, color: "#C084FC", label: "Link" },
};

function AnnotationRow({
  annotation,
  index,
  onDelete,
}: {
  annotation: Annotation;
  index: number;
  onDelete: (id: number) => void;
}) {
  const qc = useQueryClient();
  const togglePin = useToggleAnnotationPin();
  const { toast } = useToast();
  const type = annotation.type as keyof typeof typeConfig;
  const config = typeConfig[type] ?? typeConfig.text;
  const Icon = config.icon;

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin.mutate(
      { id: annotation.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAnnotationsQueryKey() });
          toast({ description: annotation.isPinned ? "Unpinned" : "Pinned annotation" });
        },
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link href={`/annotations/${annotation.id}`}>
        <div
          className="group flex items-start gap-3 p-4 rounded-lg border border-border bg-card hover:border-border/60 hover:bg-card/80 transition-all cursor-pointer"
          data-testid={`annotation-row-${annotation.id}`}
        >
          <div
            className="mt-0.5 w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: config.color + "22" }}
          >
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-foreground truncate">{annotation.title}</h3>
              {annotation.isPinned && <Pin className="w-3 h-3 text-orange-400 shrink-0" />}
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                {type}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{annotation.content}</p>
            {annotation.sourceTitle && (
              <p className="text-[10px] text-muted-foreground/70 mt-1 truncate">
                {annotation.sourceTitle}
              </p>
            )}
            <div className="flex gap-1 mt-2 flex-wrap">
              {annotation.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-secondary text-secondary-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={handleTogglePin}
              data-testid={`button-pin-${annotation.id}`}
            >
              <Pin className={`w-3.5 h-3.5 ${annotation.isPinned ? "text-orange-400" : "text-muted-foreground"}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(annotation.id);
              }}
              data-testid={`button-delete-${annotation.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          <time className="text-[10px] text-muted-foreground shrink-0 mt-1">
            {new Date(annotation.updatedAt).toLocaleDateString()}
          </time>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Annotations() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const params: Record<string, string> = {};
  if (typeFilter !== "all") params.type = typeFilter;
  if (search) params.search = search;

  const { data: annotations, isLoading } = useListAnnotations(
    Object.keys(params).length > 0 ? params : undefined
  );
  const deleteAnnotation = useDeleteAnnotation();

  const handleDelete = () => {
    if (!deleteId) return;
    deleteAnnotation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAnnotationsQueryKey() });
          toast({ description: "Annotation deleted" });
          setDeleteId(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Annotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {annotations ? `${annotations.length} annotation${annotations.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        <Button asChild size="sm" data-testid="button-new-annotation">
          <Link href="/annotations/new">
            <Plus className="w-4 h-4 mr-1.5" />
            New
          </Link>
        </Button>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search annotations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-search"
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9 text-sm" data-testid="select-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="highlight">Highlight</SelectItem>
            <SelectItem value="drawing">Drawing</SelectItem>
            <SelectItem value="link">Link</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-4 rounded-lg border border-border">
                <Skeleton className="w-8 h-8 rounded-md shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3 mb-2" />
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))
          ) : annotations && annotations.length > 0 ? (
            annotations.map((annotation, i) => (
              <AnnotationRow
                key={annotation.id}
                annotation={annotation}
                index={i}
                onDelete={setDeleteId}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 text-muted-foreground"
              data-testid="empty-state"
            >
              <StickyNote className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No annotations found</p>
              {(search || typeFilter !== "all") ? (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1"
                  onClick={() => { setSearch(""); setTypeFilter("all"); }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button variant="link" size="sm" className="mt-1" asChild>
                  <Link href="/annotations/new">Create your first annotation</Link>
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete annotation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
