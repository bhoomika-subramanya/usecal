import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  StickyNote, 
  Tags, 
  Settings, 
  PlusSquare,
  Command,
  Search
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Annotations", href: "/annotations", icon: StickyNote },
  { name: "Tags", href: "/tags", icon: Tags },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut for popup
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLocation('/popup');
      }
      // N for new annotation (only if not in an input)
      if (e.key.toLowerCase() === 'n' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setLocation('/annotations/new');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);

  // Don't render sidebar on popup route
  if (location === "/popup") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold text-sidebar-foreground">
            <Command className="w-5 h-5" />
            <span>Annotator</span>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-1 mb-8">
            <Link href="/annotations/new" className="w-full flex items-center justify-between gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-2 rounded-md text-sm font-medium transition-colors">
              <div className="flex items-center gap-2">
                <PlusSquare className="w-4 h-4" />
                <span>New Note</span>
              </div>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground opacity-100">
                N
              </kbd>
            </Link>
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <Link href="/popup" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-accent">
            <Command className="w-4 h-4" />
            <div className="flex flex-col">
              <span>Open Popup</span>
              <span className="font-mono text-[10px] opacity-70">Ctrl+Shift+L</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}