import { redirect } from "next/navigation";
import { getRequiredUser } from "@/lib/supabase/server";
import { DocumentsList } from "@/components/dashboard/documents-list";
import type { Case, Document } from "@/types";

export default async function DocumentsPage() {
  const { supabase, user } = await getRequiredUser();

  const { data: caseData } = await supabase
    .from("cases")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!caseData) redirect("/intake");

  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("case_id", (caseData as Case).id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground mt-0.5">
          All documents for your case
        </p>
      </div>
      <DocumentsList documents={(documents || []) as Document[]} />
    </div>
  );
}
