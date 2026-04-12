import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  StickyNote,
  Highlighter,
  PenLine,
  Link2,
  Pin,
  Tag,
  Plus,
  Clock,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetAnnotationStats,
  useGetRecentAnnotations,
} from "@workspace/api-client-react";
import type { Annotation } from "@workspace/api-client-react";

const typeConfig = {
  text: { icon: StickyNote, color: "#FACC15", label: "Text" },
  highlight: { icon: Highlighter, color: "#4ADE80", label: "Highlight" },
  drawing: { icon: PenLine, color: "#60A5FA", label: "Drawing" },
  link: { icon: Link2, color: "#C084FC", label: "Link" },
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  index,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35 }}
    >
      <Card className="hover:border-border/80 transition-colors" data-testid={`stat-card-${label.toLowerCase()}`}>
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                {label}
              </p>
              <p className="text-3xl font-bold text-foreground">{value}</p>
            </div>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + "22" }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AnnotationCard({ annotation, index }: { annotation: Annotation; index: number }) {
  const type = annotation.type as keyof typeof typeConfig;
  const config = typeConfig[type] ?? typeConfig.text;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.06, duration: 0.3 }}
    >
      <Link href={`/annotations/${annotation.id}`}>
        <div
          className="group flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
          data-testid={`recent-annotation-${annotation.id}`}
        >
          <div
            className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: config.color + "22" }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground truncate">
                {annotation.title}
              </p>
              {annotation.isPinned && (
                <Pin className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {annotation.content}
            </p>
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {annotation.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-secondary text-secondary-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <time className="text-[10px] text-muted-foreground shrink-0 mt-1">
            {new Date(annotation.updatedAt).toLocaleDateString()}
          </time>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAnnotationStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentAnnotations({ limit: 8 });

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your annotation workspace</p>
        </div>
        <Button asChild size="sm" data-testid="button-new-annotation">
          <Link href="/annotations/new">
            <Plus className="w-4 h-4 mr-1.5" />
            New Annotation
          </Link>
        </Button>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4 px-5">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-8 w-10" />
              </CardContent>
            </Card>
          ))
        ) : stats ? (
          <>
            <StatCard label="Total" value={stats.total} icon={TrendingUp} color="#6366F1" index={0} />
            <StatCard label="Text" value={stats.byType.text} icon={StickyNote} color="#FACC15" index={1} />
            <StatCard label="Highlight" value={stats.byType.highlight} icon={Highlighter} color="#4ADE80" index={2} />
            <StatCard label="Drawing" value={stats.byType.drawing} icon={PenLine} color="#60A5FA" index={3} />
            <StatCard label="Link" value={stats.byType.link} icon={Link2} color="#C084FC" index={4} />
            <StatCard label="Pinned" value={stats.pinned} icon={Pin} color="#F97316" index={5} />
          </>
        ) : null}
      </div>

      {/* Recent annotations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recent Annotations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {recentLoading ? (
              <div className="space-y-3 px-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-7 h-7 rounded-md shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-3.5 w-3/4 mb-1.5" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recent && recent.length > 0 ? (
              <div>
                {recent.map((annotation, i) => (
                  <AnnotationCard key={annotation.id} annotation={annotation} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No annotations yet</p>
                <Link href="/annotations/new">
                  <Button variant="link" size="sm" className="mt-1">Create your first one</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Tag className="w-4 h-4 text-muted-foreground" />
              Pinned Annotations
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {recentLoading ? (
              <div className="space-y-2 px-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : recent ? (
              <div className="space-y-1">
                {recent
                  .filter((a) => a.isPinned)
                  .map((annotation) => {
                    const type = annotation.type as keyof typeof typeConfig;
                    const config = typeConfig[type] ?? typeConfig.text;
                    const Icon = config.icon;
                    return (
                      <Link key={annotation.id} href={`/annotations/${annotation.id}`}>
                        <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer" data-testid={`pinned-${annotation.id}`}>
                          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: config.color + "22" }}>
                            <Icon className="w-3 h-3" style={{ color: config.color }} />
                          </div>
                          <span className="text-xs font-medium text-foreground truncate">{annotation.title}</span>
                        </div>
                      </Link>
                    );
                  })}
                {recent.filter((a) => a.isPinned).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No pinned annotations</p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Type breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Annotation Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(typeConfig).map(([type, config]) => {
              const Icon = config.icon;
              const count = stats?.byType[type as keyof typeof stats.byType] ?? 0;
              const total = stats?.total ?? 1;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <Link key={type} href={`/annotations?type=${type}`}>
                  <div className="p-3 rounded-lg border border-border hover:border-border/60 bg-card hover:bg-accent/30 transition-colors cursor-pointer" data-testid={`type-card-${type}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                      <span className="text-xs font-medium text-foreground capitalize">{type}</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">{count}</p>
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: config.color }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{pct}% of total</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
