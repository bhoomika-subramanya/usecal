import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Plus, Tag, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useListTags, useCreateTag, getListTagsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const PRESET_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#FACC15", "#4ADE80", "#2DD4BF", "#60A5FA", "#94A3B8",
];

export default function Tags() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366F1");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tags, isLoading } = useListTags();
  const createTag = useCreateTag();

  const handleCreate = () => {
    if (!name.trim()) return;
    createTag.mutate(
      { data: { name: name.trim(), color } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTagsQueryKey() });
          toast({ description: `Tag "${name}" created` });
          setName("");
          setColor("#6366F1");
          setOpen(false);
        },
        onError: () => {
          toast({ description: "Failed to create tag", variant: "destructive" });
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tags ? `${tags.length} tag${tags.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-tag">
          <Plus className="w-4 h-4 mr-1.5" />
          New Tag
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-6 w-8" />
              </CardContent>
            </Card>
          ))
        ) : tags && tags.length > 0 ? (
          tags.map((tag, i) => (
            <motion.div
              key={tag.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <Link href={`/annotations?tag=${encodeURIComponent(tag.name)}`}>
                <Card className="hover:border-border/60 hover:bg-card/80 transition-all cursor-pointer group" data-testid={`tag-card-${tag.id}`}>
                  <CardContent className="pt-5 pb-4 px-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: tag.color + "33" }}
                      >
                        <Hash className="w-3 h-3" style={{ color: tag.color }} />
                      </div>
                      <span className="text-sm font-medium text-foreground group-hover:text-foreground/90 truncate">
                        {tag.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-foreground">{tag.annotationCount}</span>
                      <span className="text-xs text-muted-foreground">annotations</span>
                    </div>
                    <div className="mt-3 h-1 rounded-full" style={{ backgroundColor: tag.color + "33" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ backgroundColor: tag.color, width: tag.annotationCount > 0 ? "100%" : "0%" }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-16 text-muted-foreground">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No tags yet</p>
            <Button variant="link" size="sm" className="mt-1" onClick={() => setOpen(true)}>
              Create your first tag
            </Button>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                placeholder="Tag name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                data-testid="input-tag-name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: color === c ? "white" : "transparent",
                    }}
                    onClick={() => setColor(c)}
                    data-testid={`color-${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createTag.isPending}
              data-testid="button-create-tag"
            >
              Create Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
