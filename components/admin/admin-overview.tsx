"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_MAP, STAGE_LABELS } from "@/lib/constants";
import { Sparkles } from "lucide-react";

interface CaseWithProfile {
  id: string;
  case_number: string;
  current_stage: number;
  stage_status: string;
  mltc: string;
  current_hours: number;
  requested_hours: number;
  tier: string;
  updated_at: string;
  profile?: {
    name: string;
  };
}

interface AdminOverviewProps {
  cases: CaseWithProfile[];
  stats: {
    activeCases: number;
    docsToReview: number;
    whiteGloveCount: number;
    revenue: number;
  };
}

export function AdminOverview({ cases, stats }: AdminOverviewProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.profile?.name?.toLowerCase().includes(q) ||
      c.case_number.toLowerCase().includes(q) ||
      c.mltc.toLowerCase().includes(q)
    );
  });

  const statCards = [
    { label: "Active Cases", value: stats.activeCases, icon: "📋", highlight: false },
    { label: "Docs to Review", value: stats.docsToReview, icon: "📄", highlight: stats.docsToReview > 0 },
    { label: "White Glove", value: stats.whiteGloveCount, icon: "✨", highlight: false },
    { label: "Revenue (MTD)", value: `$${(stats.revenue / 100).toLocaleString()}`, icon: "💰", highlight: false },
  ];

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                {s.label}
              </span>
              <span className="text-base">{s.icon}</span>
            </div>
            <div
              className={`text-2xl font-bold ${
                s.highlight ? "text-amber-600" : "text-foreground"
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Client table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-foreground">
            All Cases
          </h3>
          <input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-md outline-none w-44 focus:border-primary focus:ring-2 focus:ring-blue-50"
          />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {["Client", "Stage", "Status", "MLTC", "Hours", "Tier", "Activity"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 text-left uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const sm = STATUS_MAP[c.stage_status] ?? STATUS_MAP.pending;
              const timeAgo = getTimeAgo(c.updated_at);

              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/clients/${c.id}`)}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">
                      {c.profile?.name ?? "Unknown"}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {c.case_number}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    Stage {c.current_stage}
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
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {timeAgo}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {search ? "No clients match your search" : "No cases yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
