import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/dashboard/nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <DashboardNav
        user={{
          name: profile?.name ?? user.user_metadata?.full_name ?? "User",
          email: user.email ?? "",
          role: profile?.role ?? "client",
        }}
      />
      <main className="flex-1 p-6 md:p-8 bg-muted/30">{children}</main>
    </div>
  );
}
