"use client";

import { useState, useRef, useEffect, useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { StepPersonalInfo } from "./step-personal-info";
import { StepMedicalConditions } from "./step-medical-conditions";
import { StepAdlAssessment } from "./step-adl-assessment";
import { StepReview } from "./step-review";
import {
  INTAKE_REVIEW_STEP,
  stepForIntakeField,
  toIntakeFieldErrors,
  validateIntakeStep,
} from "@/lib/validations";
import type { IntakeFieldErrors } from "@/lib/validations";
import {
  clearIntakeDraft,
  getIntakeDraftServerSnapshot,
  getIntakeDraftSnapshot,
  saveIntakeDraft,
  subscribeIntakeDraft,
} from "@/lib/intake-draft";
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

/**
 * Shown while we hand off to Stripe Checkout, and as the fallback when the
 * Checkout session could not be created. The intake itself is already saved at
 * this point either way — the case is never lost by abandoning payment.
 */
function SuccessScreen({ redirecting }: { redirecting: boolean }) {
  const router = useRouter();

  return (
    <div className="text-center py-12 px-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-[72px] h-[72px] rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto mb-5">
        <Check className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-2.5">
        Your case is saved
      </h2>
      <p className="text-base text-gray-500 leading-relaxed max-w-[440px] mx-auto mb-8">
        {redirecting
          ? "Taking you to secure checkout — the $99 Stage 1 fee is what starts your Request for Increase letter and your doctor's LOMN template."
          : "We couldn't open checkout just now, but nothing is lost. Pay the $99 Stage 1 fee from your billing page and we'll start writing your letters immediately."}
      </p>
      <div className="inline-flex flex-col gap-2.5 items-start text-left mb-9">
        {[
          "AI-generated Request for Increase letter",
          "LOMN template for your doctor",
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
      <div className="flex flex-col items-center gap-3">
        {redirecting ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to checkout…
          </div>
        ) : (
          <Button
            size="lg"
            onClick={() => router.push("/dashboard/billing?stage=1")}
          >
            Pay $99 & start my letters
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          onClick={() => router.push("/dashboard")}
        >
          Go to My Dashboard
        </Button>
      </div>
    </div>
  );
}

interface IntakeIssue {
  path?: unknown[];
  message?: unknown;
}

export function IntakeForm({ userId }: { userId: string }) {
  const [done, setDone] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<IntakeFieldErrors>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // The saved draft is an external store. Reading it through
  // useSyncExternalStore means React hydrates against the *server* snapshot
  // (no draft) and swaps to the client snapshot right after — no hydration
  // mismatch, and no restoring-via-setState-in-an-effect.
  const storedDraft = useSyncExternalStore(
    subscribeIntakeDraft,
    () => getIntakeDraftSnapshot(userId),
    getIntakeDraftServerSnapshot
  );

  // `null` means "untouched — follow the draft". The moment the user edits a
  // field or moves a step, their own value takes over.
  const [edited, setEdited] = useState<IntakeFormData | null>(null);
  const [visitedStep, setVisitedStep] = useState<number | null>(null);

  const data = useMemo(
    () => edited ?? { ...initialData, ...(storedDraft?.data ?? {}) },
    [edited, storedDraft]
  );
  const step =
    visitedStep ??
    Math.min(Math.max(storedDraft?.step ?? 0, 0), INTAKE_REVIEW_STEP);

  const setData = setEdited;
  const setStep = setVisitedStep;

  useEffect(() => {
    // Writing to an external system on state change — what effects are for.
    // Nothing is written until the user actually touches the form, so an
    // untouched mount can never blank out a stored draft.
    if (done) return;
    if (edited === null && visitedStep === null) return;
    saveIntakeDraft(userId, { step, data });
  }, [done, userId, step, data, edited, visitedStep]);

  const scrollToTop = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Clear a field's error as soon as the user fixes it, so the form stops
  // shouting about something that is already correct.
  const updateData = (next: IntakeFormData) => {
    setData(next);
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const remaining = validateIntakeStep(step, next);
      const cleared: IntakeFieldErrors = {};
      for (const key of Object.keys(prev) as (keyof IntakeFieldErrors)[]) {
        if (remaining[key]) cleared[key] = prev[key];
      }
      return cleared;
    });
  };

  const handleNext = () => {
    if (step >= INTAKE_REVIEW_STEP) return;

    const stepErrors = validateIntakeStep(step, data);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      setError("Please fix the highlighted fields before continuing.");
      scrollToTop();
      return;
    }

    setErrors({});
    setError("");
    setStep(step + 1);
    scrollToTop();
  };

  const handleBack = () => {
    if (step > 0) {
      setErrors({});
      setError("");
      setStep(step - 1);
      scrollToTop();
    }
  };

  // Show field errors and send the user back to the step holding the first one.
  const showFieldErrors = (fieldErrors: IntakeFieldErrors, message: string) => {
    setErrors(fieldErrors);
    setError(message);
    const targetStep = Object.keys(fieldErrors)
      .map(stepForIntakeField)
      .reduce((min, s) => Math.min(min, s), INTAKE_REVIEW_STEP);
    setStep(targetStep);
    scrollToTop();
  };

  const handleSubmit = async () => {
    // Re-check every step before hitting the network: a user who reached the
    // review step from a restored draft may never have passed step validation.
    const allErrors: IntakeFieldErrors = {};
    for (let i = 0; i < INTAKE_REVIEW_STEP; i++) {
      Object.assign(allErrors, validateIntakeStep(i, data));
    }
    if (Object.keys(allErrors).length > 0) {
      showFieldErrors(allErrors, "Please fix the highlighted fields.");
      return;
    }

    setSubmitting(true);
    setError("");
    setErrors({});

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        const issues = Array.isArray(result.issues)
          ? (result.issues as IntakeIssue[]).filter(
              (i): i is { path: unknown[]; message: string } =>
                Array.isArray(i?.path) && typeof i?.message === "string"
            )
          : [];

        if (issues.length > 0) {
          showFieldErrors(
            toIntakeFieldErrors(
              issues.map((i) => ({
                path: i.path as PropertyKey[],
                message: i.message,
              }))
            ),
            result.error || "Please fix the highlighted fields."
          );
        } else {
          setError(result.error || "Something went wrong");
        }
        setSubmitting(false);
        return;
      }

      // Clear the stored draft BEFORE anything can navigate away. Abandoning
      // Stripe Checkout lands the user back in the app, and a surviving draft
      // would resurrect the intake they just submitted. Setting `done` also
      // stops the save effect from writing it straight back.
      clearIntakeDraft(userId);
      setDone(true);

      // Send the client straight into Stripe Checkout for the $99 Stage 1 fee.
      // Generation only ever starts on payment, so ending intake without asking
      // for payment is what left clients staring at a "GENERATING" spinner.
      if (typeof result.checkoutUrl === "string" && result.checkoutUrl) {
        setRedirecting(true);
        // assign() rather than `location.href = …`: the same navigation, but
        // not a write to a value defined outside the component.
        window.location.assign(result.checkoutUrl);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  if (done) {
    return <SuccessScreen redirecting={redirecting} />;
  }

  return (
    <div ref={scrollRef} data-testid="intake-form" data-step={step}>
      <ProgressBar step={step} />

      <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
        {step === 0 && (
          <StepPersonalInfo data={data} setData={updateData} errors={errors} />
        )}
        {step === 1 && (
          <StepMedicalConditions
            data={data}
            setData={updateData}
            errors={errors}
          />
        )}
        {step === 2 && <StepAdlAssessment data={data} setData={updateData} />}
        {step === 3 && <StepReview data={data} />}
      </div>

      {error && (
        <p
          role="alert"
          data-testid="intake-error"
          className="text-sm text-destructive text-center mt-4"
        >
          {error}
        </p>
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
