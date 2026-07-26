import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS, STATUS_MAP } from "@/lib/constants";
import type { Case } from "@/types";

type CaseRow = Case & { profile?: { name: string | null } | null };

export default async function AdminClientsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("cases")
    .select("*, profile:profiles(name)")
    .order("created_at", { ascending: false });

  const cases = (data ?? []) as CaseRow[];
  const whiteGlove = cases.filter((c) => c.tier === "white_glove").length;

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-muted-foreground mt-0.5">
          Every case on the platform
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Total Cases
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">
            {cases.length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            White Glove
          </span>
          <div className="text-2xl font-bold text-purple-600 mt-1">
            {whiteGlove}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Self-serve
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">
            {cases.length - whiteGlove}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-foreground">
            All Clients
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {["Client", "Stage", "Status", "MLTC", "Hours", "Tier", ""].map(
                (h, i) => (
                  <th
                    key={h || `spacer-${i}`}
                    className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 text-left uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const sm = STATUS_MAP[c.stage_status] ?? STATUS_MAP.pending;
              return (
                <tr
                  key={c.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      {c.profile?.name || "Unknown"}
                    </Link>
                    <div className="text-[11px] text-gray-400">
                      {c.case_number}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    <div className="font-medium">Stage {c.current_stage}</div>
                    <div className="text-[11px] text-gray-400">
                      {STAGE_LABELS[c.current_stage]}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                      style={{
                        background: sm.bg,
                        color: sm.color,
                        borderColor: sm.border,
                      }}
                    >
                      <span
                        className="w-[5px] h-[5px] rounded-full"
                        style={{ background: sm.color }}
                      />
                      {sm.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">{c.mltc}</td>
                  <td className="px-4 py-3 text-xs font-medium text-foreground">
                    {c.current_hours}→{c.requested_hours}
                  </td>
                  <td className="px-4 py-3">
                    {c.tier === "white_glove" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-600">
                        <Sparkles className="h-3 w-3" />
                        White Glove
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        Self-serve
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clients/${c.id}`}
                      aria-label={`Open case ${c.case_number}`}
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      View
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {cases.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No cases yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
