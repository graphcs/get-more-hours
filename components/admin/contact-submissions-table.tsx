"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

type Status = "new" | "contacted" | "resolved";

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: Status;
  created_at: string;
}

interface Props {
  submissions: ContactSubmission[];
}

const STATUS_STYLES: Record<Status, string> = {
  new: "bg-amber-50 text-amber-600 border-amber-200",
  contacted: "bg-blue-50 text-primary border-blue-200",
  resolved: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

const STATUS_OPTIONS: Status[] = ["new", "contacted", "resolved"];

export function ContactSubmissionsTable({ submissions }: Props) {
  const [rows, setRows] = useState(submissions);

  async function handleChangeStatus(id: string, next: Status) {
    const prev = rows;
    setRows(rows.map((r) => (r.id === id ? { ...r, status: next } : r)));
    try {
      const res = await fetch(`/api/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update");
      }
    } catch (err) {
      setRows(prev);
      toast.error(
        err instanceof Error ? err.message : "Failed to update status"
      );
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-[15px] font-semibold text-foreground">
          All Inquiries
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-gray-400">
          No inquiries yet
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">
                      {r.name}
                    </span>
                    <span className="text-xs text-gray-500">{r.email}</span>
                    {r.phone && (
                      <span className="text-xs text-gray-400">
                        · {r.phone}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {r.message}
                  </p>
                  <div className="text-[11px] text-gray-400 mt-1.5">
                    {new Date(r.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1.5"
                      >
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_STYLES[r.status]}`}
                        >
                          {r.status}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="min-w-32">
                    {STATUS_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={() => handleChangeStatus(r.id, opt)}
                      >
                        {opt}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
