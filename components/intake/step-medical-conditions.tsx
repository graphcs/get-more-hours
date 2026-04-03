"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MEDICAL_CONDITIONS } from "@/lib/constants";
import type { IntakeFormData } from "@/types";
import { Lightbulb } from "lucide-react";

interface StepProps {
  data: IntakeFormData;
  setData: (data: IntakeFormData) => void;
}

function ConditionCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-2.5 w-full p-3 text-left cursor-pointer rounded-lg border transition-all ${
        checked
          ? "bg-blue-50 border-blue-300"
          : "bg-white border-gray-300 hover:border-gray-400"
      }`}
    >
      <div
        className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-all ${
          checked
            ? "border-primary bg-primary"
            : "border-gray-300 bg-transparent"
        }`}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6L5 8.5L9.5 3.5"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <span
        className={`text-sm ${
          checked ? "font-medium text-foreground" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function StepMedicalConditions({ data, setData }: StepProps) {
  const toggle = (condition: string) => {
    const next = data.conditions.includes(condition)
      ? data.conditions.filter((c) => c !== condition)
      : [...data.conditions, condition];
    setData({ ...data, conditions: next });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1.5">
        Medical Conditions
      </h2>
      <p className="text-[15px] text-gray-500 mb-7 leading-relaxed">
        Select all conditions that apply. This information strengthens your
        request for more hours.
      </p>

      <div className="flex items-start gap-2.5 p-3 px-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
        <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          Select everything that applies — even conditions that seem minor. Each
          one helps build a stronger case for the hours you need.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6">
        {MEDICAL_CONDITIONS.map((c) => (
          <ConditionCard
            key={c}
            label={c}
            checked={data.conditions.includes(c)}
            onChange={() => toggle(c)}
          />
        ))}
      </div>

      <div className="mb-5">
        <Label className="text-[15px] font-medium text-foreground mb-1 block">
          Other Medical Conditions
        </Label>
        <p className="text-sm text-gray-500 mb-1.5">
          List any conditions not shown above, separated by commas
        </p>
        <Input
          value={data.otherConditions}
          onChange={(e) =>
            setData({ ...data, otherConditions: e.target.value })
          }
          placeholder="e.g., Fibromyalgia, Sleep Apnea"
        />
      </div>

      <div className="h-px bg-gray-200 my-6" />

      <div className="mb-5">
        <Label className="text-[15px] font-medium text-foreground mb-1 block">
          What has changed recently?
          <span className="text-destructive ml-1">*</span>
        </Label>
        <p className="text-sm text-gray-500 mb-1.5 leading-snug">
          Describe what changed in the patient&apos;s health or daily life that
          makes more hours necessary. This is very important for your case.
        </p>
        <Textarea
          value={data.changeDescription}
          onChange={(e) =>
            setData({ ...data, changeDescription: e.target.value })
          }
          rows={5}
          placeholder='For example: "My mother had a fall in January and broke her hip. Since then, she cannot walk without help and needs assistance getting to the bathroom, getting dressed, and preparing meals. She also has worsening dementia and cannot be left alone safely."'
        />
      </div>
    </div>
  );
}
