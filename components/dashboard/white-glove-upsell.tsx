import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function WhiteGloveUpsell() {
  return (
    <div className="rounded-xl p-5 px-6 bg-gradient-to-br from-slate-800 to-primary shadow-md">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-4 w-4 text-white" />
        <span className="text-sm font-bold text-white">
          White Glove Service
        </span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white/90">
          $199
        </span>
      </div>
      <p className="text-xs text-white/75 mb-3 leading-relaxed">
        Let us handle document submission, case manager communication, and more.
      </p>
      <Button
        variant="secondary"
        className="w-full bg-white text-primary hover:bg-white/90 font-semibold text-sm"
      >
        Learn More
      </Button>
    </div>
  );
}
