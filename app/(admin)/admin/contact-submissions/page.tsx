import { createClient } from "@/lib/supabase/server";
import { ContactSubmissionsTable } from "@/components/admin/contact-submissions-table";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: "new" | "contacted" | "resolved";
  created_at: string;
}

export default async function ContactSubmissionsPage() {
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (submissions || []) as ContactSubmission[];
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Inquiries</h1>
        <p className="text-muted-foreground mt-0.5">
          Contact form submissions from the marketing site
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3.5 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            New
          </span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {counts.new || 0}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Contacted
          </span>
          <div className="text-2xl font-bold text-primary mt-1">
            {counts.contacted || 0}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Resolved
          </span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {counts.resolved || 0}
          </div>
        </div>
      </div>

      <ContactSubmissionsTable submissions={rows} />
    </div>
  );
}
