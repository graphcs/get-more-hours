import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mt-2" />
      </div>

      <div className="grid grid-cols-4 gap-3.5 mb-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 bg-white border border-gray-200 rounded-xl animate-pulse"
          />
        ))}
      </div>

      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
