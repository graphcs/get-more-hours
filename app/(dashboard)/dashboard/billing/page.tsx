import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS, PRICING } from "@/lib/constants";
import { BillingClient } from "@/components/dashboard/billing-client";
import type { Case, BillingRecord } from "@/types";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: caseData } = await supabase
    .from("cases")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!caseData) redirect("/intake");

  const { data: billing } = await supabase
    .from("billing")
    .select("*")
    .eq("case_id", caseData.id)
    .order("created_at", { ascending: true });

  const typedCase = caseData as Case;
  const records = (billing || []) as BillingRecord[];

  const stages = [
    { num: 1, label: STAGE_LABELS[1], price: PRICING.stage1 },
    { num: 2, label: STAGE_LABELS[2], price: PRICING.stage2 },
    { num: 3, label: STAGE_LABELS[3], price: PRICING.stage3 },
  ];

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-0.5">
          Manage payments for your case
        </p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {stages.map((s) => {
          const paid = records.some(
            (r) => r.stage === s.num && r.type === "stage_fee" && r.status === "paid"
          );
          const isCurrent = typedCase.current_stage === s.num;

          return (
            <div
              key={s.num}
              className={`bg-white border rounded-xl p-5 shadow-sm ${
                isCurrent ? "border-primary" : "border-gray-200"
              }`}
            >
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Stage {s.num}
              </div>
              <div className="text-sm font-semibold text-foreground mb-2">
                {s.label}
              </div>
              <div className="text-2xl font-bold text-foreground mb-3">
                ${(s.price / 100).toFixed(0)}
              </div>
              {paid ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                  Paid
                </span>
              ) : isCurrent ? (
                <BillingClient caseId={typedCase.id} stage={s.num} />
              ) : (
                <span className="text-xs text-gray-400">Not yet available</span>
              )}
            </div>
          );
        })}
      </div>

      {/* White Glove add-on */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-foreground mb-1">
              White Glove Service
            </div>
            <p className="text-xs text-gray-500 max-w-md">
              Add dedicated advocate support to any stage — we handle
              submissions, communications, and deadline tracking.
            </p>
          </div>
          <div className="text-xl font-bold text-purple-600">
            +${(PRICING.whiteGlove / 100).toFixed(0)}/stage
          </div>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 px-6 shadow-sm">
        <h3 className="text-[15px] font-semibold text-foreground mb-3">
          Payment History
        </h3>
        {records.length === 0 ? (
          <p className="text-sm text-gray-400">No payments yet</p>
        ) : (
          <div className="grid gap-1">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0"
              >
                <div>
                  <span className="text-sm text-foreground">
                    {STAGE_LABELS[r.stage]} —{" "}
                    {r.type === "white_glove" ? "White Glove" : "Stage Fee"}
                  </span>
                  <span className="text-[11px] text-gray-400 block">
                    {new Date(r.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    ${(r.amount / 100).toFixed(2)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      r.status === "paid"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : "bg-amber-50 text-amber-600 border-amber-200"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
