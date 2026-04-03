"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MLTC_OPTIONS } from "@/lib/constants";
import type { IntakeFormData } from "@/types";
import { Shield } from "lucide-react";

interface StepProps {
  data: IntakeFormData;
  setData: (data: IntakeFormData) => void;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <Label className="text-[15px] font-medium text-foreground mb-1 block">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {hint && (
        <p className="text-sm text-gray-500 mb-1.5 leading-snug">{hint}</p>
      )}
      {children}
    </div>
  );
}

const hoursOptions = Array.from({ length: 24 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} hour${i > 0 ? "s" : ""}`,
}));

const daysOptions = Array.from({ length: 7 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} day${i > 0 ? "s" : ""}`,
}));

export function StepPersonalInfo({ data, setData }: StepProps) {
  const update = (field: string, value: string | number) => {
    setData({ ...data, [field]: value });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1.5">
        Tell us about yourself
      </h2>
      <p className="text-[15px] text-gray-500 mb-7 leading-relaxed">
        We need some basic information to get started. This helps us personalize
        your case.
      </p>

      <div className="flex items-start gap-2.5 p-3 px-4 bg-blue-50 border border-blue-100 rounded-lg mb-6">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          Your information is protected with bank-level encryption and is never
          shared without your permission.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="First Name" required>
          <Input
            value={data.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="Jane"
          />
        </Field>
        <Field label="Last Name" required>
          <Input
            value={data.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Doe"
          />
        </Field>
      </div>

      <Field label="Date of Birth" required>
        <Input
          type="date"
          value={data.dob}
          onChange={(e) => update("dob", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Phone Number" required>
          <Input
            type="tel"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(212) 555-0000"
          />
        </Field>
        <Field label="Email" hint="Optional — for case updates">
          <Input
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="jane@example.com"
          />
        </Field>
      </div>

      <Field label="Address" required>
        <Input
          value={data.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="123 Main Street, Apt 4B"
        />
      </Field>

      <div className="grid grid-cols-[2fr_1fr_1fr] gap-x-4">
        <Field label="City" required>
          <Input
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Brooklyn"
          />
        </Field>
        <Field label="State">
          <Input value="NY" disabled className="bg-gray-50" />
        </Field>
        <Field label="ZIP Code" required>
          <Input
            value={data.zip}
            onChange={(e) => update("zip", e.target.value)}
            placeholder="11201"
          />
        </Field>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      <h3 className="text-lg font-semibold text-foreground mb-4">
        Current Home Care
      </h3>

      <Field
        label="MLTC Company"
        required
        hint="The managed care plan providing your home care"
      >
        <select
          value={data.mltc}
          onChange={(e) => update("mltc", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="" disabled>
            Select your MLTC
          </option>
          {MLTC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Current Hours Per Day" required>
          <select
            value={data.currentHours}
            onChange={(e) => update("currentHours", Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="" disabled>
              Select hours
            </option>
            {hoursOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Days Per Week" required>
          <select
            value={data.currentDays}
            onChange={(e) => update("currentDays", Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="" disabled>
              Select days
            </option>
            {daysOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="h-px bg-gray-200 my-6" />

      <h3 className="text-lg font-semibold text-foreground mb-1">
        Hours You&apos;re Requesting
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        How many hours do you believe are needed?
      </p>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Requested Hours Per Day" required>
          <select
            value={data.requestedHours}
            onChange={(e) => update("requestedHours", Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="" disabled>
              Select hours
            </option>
            {hoursOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Requested Days Per Week" required>
          <select
            value={data.requestedDays}
            onChange={(e) => update("requestedDays", Number(e.target.value))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="" disabled>
              Select days
            </option>
            {daysOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  );
}
