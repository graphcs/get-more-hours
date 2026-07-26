import { redirect } from "next/navigation";
import { getRequiredUser } from "@/lib/supabase/server";
import { findUsableCase } from "@/lib/intake-case";
import { IntakeForm } from "@/components/intake/intake-form";

export default async function IntakePage() {
  const { supabase, user } = await getRequiredUser();

  // Only a *complete* case sends the user to the dashboard. A case row left
  // behind by a failed intake must not lock the user out of the form.
  const existingCase = await findUsableCase(supabase, user.id);

  if (existingCase) {
    redirect("/dashboard");
  }

  return <IntakeForm userId={user.id} />;
}
