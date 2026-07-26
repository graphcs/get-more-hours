"use client";

import { Label } from "@/components/ui/label";
import { isIntakeFieldRequired } from "@/lib/validations";
import type { IntakeField, IntakeFieldErrors } from "@/lib/validations";
import type { IntakeFormData } from "@/types";

export interface StepProps {
  data: IntakeFormData;
  setData: (data: IntakeFormData) => void;
  errors?: IntakeFieldErrors;
}

/**
 * Props to spread onto the input/select/textarea a `Field` wraps so the control
 * is labelled and announces its own error state.
 */
export function fieldControlProps(
  name: IntakeField,
  errors?: IntakeFieldErrors
) {
  const invalid = Boolean(errors?.[name]);
  return {
    id: name,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `${name}-error` : undefined,
  };
}

/**
 * A labelled form row. The required asterisk is derived from `intakeSchema`
 * rather than passed in, so the marker always reflects what is actually
 * enforced — both when advancing a step and on final submit.
 */
export function Field({
  name,
  label,
  hint,
  errors,
  children,
}: {
  name: IntakeField;
  label: string;
  hint?: string;
  errors?: IntakeFieldErrors;
  children: React.ReactNode;
}) {
  const required = isIntakeFieldRequired(name);
  const error = errors?.[name];

  return (
    <div className="mb-5">
      <Label
        htmlFor={name}
        className="text-[15px] font-medium text-foreground mb-1 block"
      >
        {label}
        {required && (
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </Label>
      {hint && (
        <p className="text-sm text-gray-500 mb-1.5 leading-snug">{hint}</p>
      )}
      {children}
      {error && (
        <p
          id={`${name}-error`}
          role="alert"
          data-testid={`error-${name}`}
          className="mt-1.5 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
