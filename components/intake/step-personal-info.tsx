"use client";

import { Input } from "@/components/ui/input";
import { MLTC_OPTIONS } from "@/lib/constants";
import { Field, fieldControlProps } from "./field";
import type { StepProps } from "./field";
import type { IntakeFormData } from "@/types";
import { Shield } from "lucide-react";

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-[15px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20";

const hoursOptions = Array.from({ length: 24 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} hour${i > 0 ? "s" : ""}`,
}));

const daysOptions = Array.from({ length: 7 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} day${i > 0 ? "s" : ""}`,
}));

export function StepPersonalInfo({ data, setData, errors }: StepProps) {
  const update = (field: keyof IntakeFormData, value: string | number) => {
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
        <Field name="firstName" label="First Name" errors={errors}>
          <Input
            {...fieldControlProps("firstName", errors)}
            value={data.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="Jane"
          />
        </Field>
        <Field name="lastName" label="Last Name" errors={errors}>
          <Input
            {...fieldControlProps("lastName", errors)}
            value={data.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Doe"
          />
        </Field>
      </div>

      <Field name="dob" label="Date of Birth" errors={errors}>
        <Input
          {...fieldControlProps("dob", errors)}
          type="date"
          value={data.dob}
          onChange={(e) => update("dob", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-4">
        <Field name="phone" label="Phone Number" errors={errors}>
          <Input
            {...fieldControlProps("phone", errors)}
            type="tel"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(212) 555-0000"
          />
        </Field>
        <Field
          name="email"
          label="Email"
          hint="Optional — for case updates"
          errors={errors}
        >
          <Input
            {...fieldControlProps("email", errors)}
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="jane@example.com"
          />
        </Field>
      </div>

      <Field name="address" label="Address" errors={errors}>
        <Input
          {...fieldControlProps("address", errors)}
          value={data.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="123 Main Street, Apt 4B"
        />
      </Field>

      <div className="grid grid-cols-[2fr_1fr_1fr] gap-x-4">
        <Field name="city" label="City" errors={errors}>
          <Input
            {...fieldControlProps("city", errors)}
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="Brooklyn"
          />
        </Field>
        <Field name="state" label="State" errors={errors}>
          <Input
            {...fieldControlProps("state", errors)}
            value="NY"
            disabled
            className="bg-gray-50"
          />
        </Field>
        <Field name="zip" label="ZIP Code" errors={errors}>
          <Input
            {...fieldControlProps("zip", errors)}
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
        name="mltc"
        label="MLTC Company"
        hint="The managed care plan providing your home care"
        errors={errors}
      >
        <select
          {...fieldControlProps("mltc", errors)}
          value={data.mltc}
          onChange={(e) => update("mltc", e.target.value)}
          className={selectClass}
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
        <Field
          name="currentHours"
          label="Current Hours Per Day"
          errors={errors}
        >
          <select
            {...fieldControlProps("currentHours", errors)}
            value={data.currentHours}
            onChange={(e) => update("currentHours", Number(e.target.value))}
            className={selectClass}
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
        <Field name="currentDays" label="Days Per Week" errors={errors}>
          <select
            {...fieldControlProps("currentDays", errors)}
            value={data.currentDays}
            onChange={(e) => update("currentDays", Number(e.target.value))}
            className={selectClass}
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
        <Field
          name="requestedHours"
          label="Requested Hours Per Day"
          errors={errors}
        >
          <select
            {...fieldControlProps("requestedHours", errors)}
            value={data.requestedHours}
            onChange={(e) => update("requestedHours", Number(e.target.value))}
            className={selectClass}
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
        <Field
          name="requestedDays"
          label="Requested Days Per Week"
          errors={errors}
        >
          <select
            {...fieldControlProps("requestedDays", errors)}
            value={data.requestedDays}
            onChange={(e) => update("requestedDays", Number(e.target.value))}
            className={selectClass}
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
