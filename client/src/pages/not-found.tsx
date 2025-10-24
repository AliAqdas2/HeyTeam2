import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <Card className="max-w-md">
        <CardContent className="p-12 text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
          <h1 className="text-3xl font-semibold mb-3">Page Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/">
            <a data-testid="link-home">
              <Button className="gap-2">
                <Home className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </a>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
