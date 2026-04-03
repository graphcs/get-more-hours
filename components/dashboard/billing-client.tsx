"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BillingClientProps {
  caseId: string;
  stage: number;
}

export function BillingClient({ caseId, stage }: BillingClientProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async (includeWhiteGlove: boolean = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, stage, includeWhiteGlove }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        size="sm"
        className="w-full text-xs"
        onClick={() => handleCheckout(false)}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
        Pay Now
      </Button>
    </div>
  );
}
