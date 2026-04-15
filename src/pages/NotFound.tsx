import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="space-y-6 max-w-md border border-gray-200 bg-white p-12 shadow-sm rounded-sm">
        <div className="space-y-3">
          <h1 className="text-6xl font-bold text-primary tracking-tighter">404</h1>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">
            Page Not Found
          </h2>
          <p className="text-xs text-gray-500 font-medium leading-relaxed">
            The page you're looking for doesn't exist or may have been moved to a different workspace.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-4">
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 rounded-sm font-semibold h-9 px-6">
            <a href="/">Return Dashboard</a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.history.back()} className="border-gray-200 rounded-sm font-semibold h-9 px-6">
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
