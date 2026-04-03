import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntakeForm } from "@/components/intake/intake-form";

export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user already has a case
  const { data: existingCase } = await supabase
    .from("cases")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (existingCase) {
    redirect("/dashboard");
  }

  return <IntakeForm />;
}
