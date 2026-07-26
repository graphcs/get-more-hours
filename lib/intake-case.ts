import type { createServerClient } from "@supabase/ssr";

type SupabaseServerClient = ReturnType<typeof createServerClient>;

/**
 * Find the user's existing case, treating a case with no `intake_data` row as
 * debris from a failed intake rather than a real case.
 *
 * Intake creates several rows (case → intake_data → billing → placeholder
 * documents) and Supabase gives us no cross-statement transaction from the
 * edge. If a later insert failed, the orphaned `cases` row used to make
 * `/intake` redirect to `/dashboard` and the API return 409 — locking the user
 * out of the product permanently. Discarding the orphan makes intake resumable
 * (and self-heals users who are already stuck).
 */
export async function findUsableCase(
  supabase: SupabaseServerClient,
  userId: string
): Promise<{ id: string } | null> {
  const { data: existingCase } = await supabase
    .from("cases")
    .select("id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!existingCase) return null;

  const { data: intake } = await supabase
    .from("intake_data")
    .select("case_id")
    .eq("case_id", existingCase.id)
    .maybeSingle();

  if (intake) return existingCase as { id: string };

  // Incomplete case — remove it (FKs cascade) so intake can start over.
  await supabase.from("cases").delete().eq("id", existingCase.id);
  return null;
}
