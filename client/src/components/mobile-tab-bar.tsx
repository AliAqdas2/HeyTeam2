import { Link, useLocation } from "wouter";
import { Briefcase, Calendar, Users, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/templates", label: "Templates", icon: FileText },
];

export function MobileTabBar() {
  const [location] = useLocation();

  return (
    <nav
      className={cn("ios-tap")}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 9999,
        paddingTop: "10px",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        backgroundColor: "hsl(var(--background) / 0.95)",
        borderTop: "1px solid hsl(var(--border))",
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex items-center justify-around h-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.path || location.startsWith(tab.path + "/");
          
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                "flex flex-col items-center justify-center",
                "flex-1 h-full",
                "transition-colors duration-200",
                "active:bg-accent/50",
                "min-w-0",
                "ios-tap ios-no-select",
                "relative"
              )}
            >
              <div className="relative flex flex-col items-center justify-center">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors duration-200",
                    "leading-tight mt-0.5",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

