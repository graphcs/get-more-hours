import { getRequiredUser } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/dashboard/profile-form";
import type { Profile } from "@/types";

export default async function ProfilePage() {
  const { supabase, user } = await getRequiredUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const p = profile as Profile | null;

  const joined = p?.created_at
    ? new Date(p.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-0.5">
          Update your name and phone number
        </p>
      </div>

      <ProfileForm
        initialName={p?.name ?? ""}
        initialPhone={p?.phone ?? ""}
        email={user.email ?? ""}
        role={p?.role ?? "client"}
        joined={joined}
      />
    </div>
  );
}
