import { useLocation } from "wouter";
import { Link } from "wouter";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface BreadcrumbConfig {
  label: string;
  path?: string;
}

export function PageBreadcrumbs() {
  const [location] = useLocation();

  const getBreadcrumbs = (): BreadcrumbConfig[] => {
    const pathParts = location.split("/").filter(Boolean);
    
    if (pathParts.length === 0 || location === "/jobs") {
      return [{ label: "Jobs", path: "/jobs" }];
    }

    const breadcrumbs: BreadcrumbConfig[] = [];

    if (location === "/contacts") {
      breadcrumbs.push({ label: "Contacts" });
    } else if (location === "/templates") {
      breadcrumbs.push({ label: "Templates" });
    } else if (location === "/calendar") {
      breadcrumbs.push({ label: "Calendar" });
    } else if (location === "/billing") {
      breadcrumbs.push({ label: "Billing" });
    } else if (location === "/messages") {
      breadcrumbs.push({ label: "Message History" });
    } else if (location === "/profile") {
      breadcrumbs.push({ label: "Profile" });
    } else if (location === "/team") {
      breadcrumbs.push({ label: "Team" });
    } else if (location === "/admin/admin.aspx") {
      breadcrumbs.push({ label: "Admin Dashboard" });
    } else if (pathParts[0] === "jobs") {
      breadcrumbs.push({ label: "Jobs", path: "/jobs" });
      
      if (pathParts[1] === "new") {
        breadcrumbs.push({ label: "New Job" });
      } else if (pathParts[2] === "edit") {
        breadcrumbs.push({ label: "Edit Job" });
      } else if (pathParts[2] === "schedule") {
        breadcrumbs.push({ label: "Schedule" });
      } else if (pathParts[2] === "send") {
        breadcrumbs.push({ label: "Send Message" });
      }
    } else {
      breadcrumbs.push({ label: "Home", path: "/" });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/jobs" data-testid="breadcrumb-home">
              <Home className="h-4 w-4" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          
          return (
            <div key={index} className="flex items-center gap-1.5 sm:gap-2.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast || !crumb.path ? (
                  <BreadcrumbPage data-testid={`breadcrumb-${crumb.label.toLowerCase().replace(/\s+/g, "-")}`}>
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.path} data-testid={`breadcrumb-${crumb.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
