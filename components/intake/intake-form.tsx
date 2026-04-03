"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { StepPersonalInfo } from "./step-personal-info";
import { StepMedicalConditions } from "./step-medical-conditions";
import { StepAdlAssessment } from "./step-adl-assessment";
import { StepReview } from "./step-review";
import type { IntakeFormData, AdlLevel } from "@/types";

const STEP_LABELS = ["Personal Info", "Medical History", "Daily Living", "Review"];

const initialData: IntakeFormData = {
  firstName: "",
  lastName: "",
  dob: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "NY",
  zip: "",
  mltc: "",
  currentHours: "",
  currentDays: "",
  requestedHours: "",
  requestedDays: "",
  conditions: [],
  otherConditions: "",
  changeDescription: "",
  adlLevels: {} as Record<string, AdlLevel>,
  adlNotes: "",
};

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2.5">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className="flex items-center" style={{ flex: i < 3 ? 1 : "none" }}>
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-all duration-300 ${
                i <= step
                  ? "bg-primary text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < step ? (
                <Check className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 3 && (
              <div className="flex-1 h-0.5 mx-2 bg-gray-200 rounded-sm relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-primary transition-all duration-500"
                  style={{ width: i < step ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className={`text-xs text-center w-20 transition-all duration-300 ${
              i <= step ? "font-semibold text-foreground" : "text-gray-400"
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SuccessScreen() {
  const router = useRouter();

  return (
    <div className="text-center py-12 px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-[72px] h-[72px] rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-5">
        <Check className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2.5">
        You&apos;re all set!
      </h2>
      <p className="text-base text-gray-500 leading-relaxed max-w-[420px] mx-auto mb-8">
        Your intake is complete. We&apos;re now preparing your Request for
        Increase letter and your doctor&apos;s LOMN template. You&apos;ll see
        them on your dashboard shortly.
      </p>
      <div className="inline-flex flex-col gap-2.5 items-start text-left mb-9">
        {[
          "AI-generated request letter — in progress",
          "LOMN template for your doctor — in progress",
        ].map((t) => (
          <div
            key={t}
            className="flex gap-2 items-center text-sm text-emerald-600 font-medium"
          >
            <Check className="h-4 w-4" />
            {t}
          </div>
        ))}
      </div>
      <div>
        <Button size="lg" onClick={() => router.push("/dashboard")}>
          Go to My Dashboard
        </Button>
      </div>
    </div>
  );
}

export function IntakeForm() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<IntakeFormData>(initialData);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
      scrollToTop();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
      scrollToTop();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (done) {
    return <SuccessScreen />;
  }

  return (
    <div ref={scrollRef}>
      <ProgressBar step={step} />

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        {step === 0 && <StepPersonalInfo data={data} setData={setData} />}
        {step === 1 && <StepMedicalConditions data={data} setData={setData} />}
        {step === 2 && <StepAdlAssessment data={data} setData={setData} />}
        {step === 3 && <StepReview data={data} />}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center mt-4">{error}</p>
      )}

      <div className="flex justify-between items-center mt-5">
        {step > 0 ? (
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
        ) : (
          <div />
        )}
        <Button
          onClick={step === 3 ? handleSubmit : handleNext}
          disabled={submitting}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {step === 3 ? "Submit & Build My Case" : "Continue"}
        </Button>
      </div>

      <p className="text-center mt-4 text-xs text-gray-400">
        Your progress is saved automatically
      </p>
    </div>
  );
}
