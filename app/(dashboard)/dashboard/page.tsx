import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { StageTracker } from "@/components/dashboard/stage-tracker";
import { NextSteps } from "@/components/dashboard/next-steps";
import { DocumentsList } from "@/components/dashboard/documents-list";
import { CaseSummary } from "@/components/dashboard/case-summary";
import { Timeline } from "@/components/dashboard/timeline";
import { WhiteGloveUpsell } from "@/components/dashboard/white-glove-upsell";
import { FileText, ArrowRight } from "lucide-react";
import type { Case, Document } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Redirect admins to admin dashboard
  if (profile?.role === "admin") {
    redirect("/admin");
  }

  // Fetch the user's case
  const { data: caseData } = await supabase
    .from("cases")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const displayName =
    profile?.name?.split(" ")[0] ??
    user?.user_metadata?.full_name?.split(" ")[0] ??
    "there";

  // No case yet — show intake CTA
  if (!caseData) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome, {displayName}</h1>
          <p className="text-muted-foreground mt-1">
            Your home care advocacy dashboard
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Start Your Case
          </h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Complete a short intake form to begin fighting for more home care
            hours. Our AI will generate your request letter automatically.
          </p>
          <Link href="/intake">
            <Button size="lg" className="gap-2">
              Begin Intake <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Fetch documents for this case
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", caseData.id)
    .order("created_at", { ascending: true });

  const typedCase = caseData as Case;
  const typedDocs = (documents || []) as Document[];

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back, {displayName}</h1>
        <p className="text-muted-foreground mt-0.5">
          Your home care advocacy dashboard
        </p>
      </div>

      {/* Stage tracker — full width */}
      <StageTracker
        currentStage={typedCase.current_stage}
        stageStatus={typedCase.stage_status}
        caseNumber={typedCase.case_number}
      />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4">
        <div>
          <NextSteps
            documents={typedDocs}
            currentStage={typedCase.current_stage}
          />
          <DocumentsList documents={typedDocs} />
        </div>

        {/* Right sidebar */}
        <div>
          <CaseSummary caseData={typedCase} />
          <Timeline
            documents={typedDocs}
            caseCreatedAt={typedCase.created_at}
          />
          <WhiteGloveUpsell />
        </div>
      </div>
    </div>
  );
}
