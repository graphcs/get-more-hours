import { Info } from "lucide-react";

interface NextStageInfoProps {
  info: string | null;
}

export function NextStageInfo({ info }: NextStageInfoProps) {
  if (!info) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
      <div className="flex gap-2.5">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-1">
            What happens next?
          </h4>
          <p className="text-sm text-gray-500 leading-relaxed">{info}</p>
        </div>
      </div>
    </div>
  );
}
