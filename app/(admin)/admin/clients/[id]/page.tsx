import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClientDetail } from "@/components/admin/client-detail";
import type { Case, IntakeData, Document, BillingRecord, CRMNote } from "@/types";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch case with profile
  const { data: caseData, error } = await supabase
    .from("cases")
    .select("*, profile:profiles(*)")
    .eq("id", id)
    .single();

  if (error || !caseData) {
    notFound();
  }

  // Fetch related data in parallel
  const [intakeRes, docsRes, billingRes, notesRes] = await Promise.all([
    supabase
      .from("intake_data")
      .select("*")
      .eq("case_id", id)
      .single(),
    supabase
      .from("documents")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("billing")
      .select("*")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("crm_notes")
      .select("*, author:profiles(id, name)")
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ClientDetail
      caseData={caseData as Case & { profile: { name: string } }}
      intake={intakeRes.data as IntakeData | null}
      documents={(docsRes.data || []) as Document[]}
      billing={(billingRes.data || []) as BillingRecord[]}
      crmNotes={(notesRes.data || []) as CRMNote[]}
    />
  );
}
