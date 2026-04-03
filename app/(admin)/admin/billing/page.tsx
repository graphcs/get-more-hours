import { createClient } from "@/lib/supabase/server";
import { STAGE_LABELS } from "@/lib/constants";
import type { BillingRecord } from "@/types";

export default async function AdminBillingPage() {
  const supabase = await createClient();

  const { data: billing } = await supabase
    .from("billing")
    .select("*, case:cases(case_number, profile:profiles(name))")
    .order("created_at", { ascending: false });

  const records = (billing || []) as (BillingRecord & {
    case?: { case_number: string; profile?: { name: string } };
  })[];

  const totalPaid = records
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);

  const totalPending = records
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing Overview</h1>
        <p className="text-muted-foreground mt-0.5">
          All payments across clients
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3.5 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Total Collected
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            ${(totalPaid / 100).toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Pending
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            ${(totalPending / 100).toLocaleString()}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Total Records
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">
            {records.length}
          </div>
        </div>
      </div>

      {/* All records */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-[15px] font-semibold text-foreground">
            All Payments
          </h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {["Client", "Stage", "Type", "Amount", "Status", "Date"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 text-left uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-100"
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-foreground">
                    {r.case?.profile?.name ?? "Unknown"}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {r.case?.case_number}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-foreground">
                  {STAGE_LABELS[r.stage]}
                </td>
                <td className="px-4 py-3 text-xs text-gray-700">
                  {r.type === "white_glove" ? "White Glove" : "Stage Fee"}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  ${(r.amount / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                      r.status === "paid"
                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                        : r.status === "refunded"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-amber-50 text-amber-600 border-amber-200"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(r.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No billing records yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
