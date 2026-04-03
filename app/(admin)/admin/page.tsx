import { createClient } from "@/lib/supabase/server";
import { AdminOverview } from "@/components/admin/admin-overview";

export default async function AdminPage() {
  const supabase = await createClient();

  // Fetch all cases with profiles
  const { data: cases } = await supabase
    .from("cases")
    .select("*, profile:profiles(*)")
    .order("updated_at", { ascending: false });

  // Fetch all documents to count review-needed
  const { data: docs } = await supabase
    .from("documents")
    .select("id, case_id, status");

  // Fetch all billing
  const { data: billing } = await supabase
    .from("billing")
    .select("amount, status");

  const allCases = cases || [];
  const allDocs = docs || [];
  const allBilling = billing || [];

  const docsToReview = allDocs.filter(
    (d) => d.status === "review_needed"
  ).length;
  const whiteGloveCount = allCases.filter((c) => c.tier === "white_glove").length;
  const revenue = allBilling
    .filter((b) => b.status === "paid")
    .reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-0.5">
          Manage all client cases and documents
        </p>
      </div>

      <AdminOverview
        cases={allCases}
        stats={{
          activeCases: allCases.length,
          docsToReview,
          whiteGloveCount,
          revenue,
        }}
      />
    </div>
  );
}
