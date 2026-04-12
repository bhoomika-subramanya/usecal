import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  StickyNote,
  Highlighter,
  PenLine,
  Link2,
  ArrowLeft,
  Pin,
  ExternalLink,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  useGetAnnotation,
  useCreateAnnotation,
  useUpdateAnnotation,
  useToggleAnnotationPin,
  getListAnnotationsQueryKey,
  getGetAnnotationQueryKey,
  getGetAnnotationStatsQueryKey,
  getGetRecentAnnotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const typeColorMap: Record<string, string> = {
  text: "#FACC15",
  highlight: "#4ADE80",
  drawing: "#60A5FA",
  link: "#C084FC",
};

const typeConfig = {
  text: { icon: StickyNote, label: "Text note" },
  highlight: { icon: Highlighter, label: "Highlight" },
  drawing: { icon: PenLine, label: "Drawing" },
  link: { icon: Link2, label: "Link" },
};

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  type: z.enum(["text", "highlight", "drawing", "link"]),
  color: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  sourceTitle: z.string().nullable().optional(),
  tags: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function AnnotationDetail() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const isNew = !params.id || params.id === "new";
  const id = isNew ? null : parseInt(params.id, 10);

  const { data: annotation, isLoading } = useGetAnnotation(
    id!,
    { query: { enabled: !!id, queryKey: getGetAnnotationQueryKey(id!) } }
  );

  const createAnnotation = useCreateAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const togglePin = useToggleAnnotationPin();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "text",
      color: "#FACC15",
      sourceUrl: "",
      sourceTitle: "",
      tags: "",
    },
  });

  useEffect(() => {
    if (annotation) {
      form.reset({
        title: annotation.title,
        content: annotation.content,
        type: annotation.type as "text" | "highlight" | "drawing" | "link",
        color: annotation.color,
        sourceUrl: annotation.sourceUrl ?? "",
        sourceTitle: annotation.sourceTitle ?? "",
        tags: annotation.tags.join(", "),
      });
    }
  }, [annotation, form]);

  const watchedType = form.watch("type");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListAnnotationsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetAnnotationStatsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentAnnotationsQueryKey() });
  };

  const onSubmit = (values: FormValues) => {
    const tags = values.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const data = {
      title: values.title,
      content: values.content,
      type: values.type,
      color: values.color ?? typeColorMap[values.type],
      sourceUrl: values.sourceUrl || null,
      sourceTitle: values.sourceTitle || null,
      tags,
    };

    if (isNew) {
      createAnnotation.mutate(
        { data },
        {
          onSuccess: (created) => {
            invalidateAll();
            toast({ description: "Annotation created" });
            setLocation(`/annotations/${created.id}`);
          },
        }
      );
    } else {
      updateAnnotation.mutate(
        { id: id!, data },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getGetAnnotationQueryKey(id!) });
            invalidateAll();
            toast({ description: "Annotation updated" });
          },
        }
      );
    }
  };

  const handleTogglePin = () => {
    if (!id) return;
    togglePin.mutate(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetAnnotationQueryKey(id) });
          invalidateAll();
        },
      }
    );
  };

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const typeConf = typeConfig[watchedType] ?? typeConfig.text;
  const TypeIcon = typeConf.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/annotations")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: typeColorMap[watchedType] + "22" }}
          >
            <TypeIcon className="w-3.5 h-3.5" style={{ color: typeColorMap[watchedType] }} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">{typeConf.label}</span>
        </div>
        {!isNew && annotation && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePin}
              data-testid="button-toggle-pin"
            >
              <Pin className={`w-3.5 h-3.5 mr-1.5 ${annotation.isPinned ? "text-orange-400" : ""}`} />
              {annotation.isPinned ? "Unpin" : "Pin"}
            </Button>
            {annotation.sourceUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={annotation.sourceUrl} target="_blank" rel="noreferrer" data-testid="link-source">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Source
                </a>
              </Button>
            )}
          </div>
        )}
      </div>

      <h1 className="text-2xl font-bold text-foreground tracking-tight mb-6">
        {isNew ? "New Annotation" : "Edit Annotation"}
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Annotation title..."
                    {...field}
                    className="text-base"
                    data-testid="input-title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="text">Text note</SelectItem>
                    <SelectItem value="highlight">Highlight</SelectItem>
                    <SelectItem value="drawing">Drawing</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Write your annotation content..."
                    rows={6}
                    {...field}
                    data-testid="textarea-content"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sourceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-source-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sourceTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Page or document title..."
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-source-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Tags
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="react, typescript, css (comma-separated)"
                    {...field}
                    data-testid="input-tags"
                  />
                </FormControl>
                <FormMessage />
                {field.value && (
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {field.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                )}
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={createAnnotation.isPending || updateAnnotation.isPending}
              data-testid="button-save"
            >
              {isNew ? "Create Annotation" : "Save Changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/annotations")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>

      {!isNew && annotation && (
        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Created {new Date(annotation.createdAt).toLocaleString()} &middot; Updated{" "}
            {new Date(annotation.updatedAt).toLocaleString()}
          </p>
        </div>
      )}
    </motion.div>
  );
}
