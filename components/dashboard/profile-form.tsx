"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface ProfileFormProps {
  initialName: string;
  initialPhone: string;
  email: string;
  role: string;
  joined: string | null;
}

export function ProfileForm({
  initialName,
  initialPhone,
  email,
  role,
  joined,
}: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  const dirty = name !== initialName || phone !== initialPhone;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save");
      }
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-xl font-bold text-primary">
          {(name || "U").charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {name || "User"}
          </h2>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            maxLength={40}
          />
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">Email</span>
          <span className="text-sm font-medium">{email}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">Role</span>
          <span className="text-sm font-medium capitalize">{role}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] items-center pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">Joined</span>
          <span className="text-sm font-medium">{joined ?? "—"}</span>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={!dirty || saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
