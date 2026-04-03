import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const p = profile as Profile | null;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-0.5">
          Your account information
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-xl font-bold text-primary">
            {(p?.name ?? "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {p?.name ?? "User"}
            </h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-[120px_1fr] items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm font-medium">{p?.name ?? "—"}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium">{user.email ?? "—"}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Phone</span>
            <span className="text-sm font-medium">{p?.phone ?? "—"}</span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Role</span>
            <span className="text-sm font-medium capitalize">
              {p?.role ?? "client"}
            </span>
          </div>
          <div className="grid grid-cols-[120px_1fr] items-center py-2">
            <span className="text-sm text-gray-500">Joined</span>
            <span className="text-sm font-medium">
              {p?.created_at
                ? new Date(p.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
