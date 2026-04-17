import { redirect, notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/supabase/server";
import { STAGE_CONFIG } from "@/lib/stage-config";
import { StageHeader } from "@/components/dashboard/stage-header";
import { StageAiDocs } from "@/components/dashboard/stage-ai-docs";
import { StageUploads } from "@/components/dashboard/stage-uploads";
import { StageTimeline } from "@/components/dashboard/stage-timeline";
import { NextStageInfo } from "@/components/dashboard/next-stage-info";
import { WhiteGloveUpsell } from "@/components/dashboard/white-glove-upsell";
import { Sparkles, Check } from "lucide-react";
import type { Case, Document, StageNumber } from "@/types";

export default async function StageDetailPage({
  params,
}: {
  params: Promise<{ num: string }>;
}) {
  const { num } = await params;
  const stageNum = parseInt(num, 10) as StageNumber;

  if (![1, 2, 3].includes(stageNum)) {
    notFound();
  }

  const { supabase, user } = await getRequiredUser();

  const { data: caseData } = await supabase
    .from("cases")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!caseData) {
    redirect("/intake");
  }

  const typedCase = caseData as Case;

  // Fetch documents for this stage
  const { data: allDocs } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", typedCase.id)
    .order("created_at", { ascending: true });

  const stageDocs = ((allDocs || []) as Document[]).filter(
    (d) => d.stage === stageNum
  );

  const config = STAGE_CONFIG[stageNum];
  const isActive = typedCase.current_stage === stageNum;
  const isCompleted = typedCase.current_stage > stageNum;

  return (
    <div className="max-w-5xl">
      <StageHeader
        stageNum={stageNum}
        isActive={isActive || isCompleted}
        stageStatus={isCompleted ? "complete" : isActive ? typedCase.stage_status : "pending"}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Left column */}
        <div>
          <StageAiDocs
            docConfigs={config.docs}
            documents={stageDocs}
          />

          <StageUploads
            uploadSlots={config.uploads}
            documents={stageDocs}
            stageNum={stageNum}
            caseId={typedCase.id}
          />

          <NextStageInfo info={config.nextInfo} />
        </div>

        {/* Right column */}
        <div>
          <StageTimeline
            steps={config.timeline}
            documents={stageDocs}
            stageNum={stageNum}
          />

          {/* White Glove upsell with stage-specific features */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-bold text-foreground">
                White Glove for Stage {stageNum}
              </span>
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">
                +$199
              </span>
            </div>
            <ul className="space-y-1.5 mb-3">
              {config.wgFeatures.map((f, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-gray-600"
                >
                  <Check className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <WhiteGloveUpsell />
        </div>
      </div>
    </div>
  );
}
