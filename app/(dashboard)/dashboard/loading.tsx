import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mt-2" />
      </div>

      {/* Stage tracker skeleton */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
        <div className="flex gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 h-32 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
