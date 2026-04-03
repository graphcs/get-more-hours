"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ADL_CATEGORIES, ADL_LEVELS } from "@/lib/constants";
import type { IntakeFormData, AdlLevel } from "@/types";
import { ClipboardList } from "lucide-react";

interface StepProps {
  data: IntakeFormData;
  setData: (data: IntakeFormData) => void;
}

const levelStyles: Record<
  string,
  { bg: string; border: string; text: string; activeBg: string; activeBorder: string; activeText: string }
> = {
  independent: {
    bg: "bg-transparent",
    border: "border-gray-300",
    text: "text-gray-500",
    activeBg: "bg-emerald-50",
    activeBorder: "border-emerald-200",
    activeText: "text-emerald-600",
  },
  some_help: {
    bg: "bg-transparent",
    border: "border-gray-300",
    text: "text-gray-500",
    activeBg: "bg-amber-50",
    activeBorder: "border-amber-200",
    activeText: "text-amber-600",
  },
  full_help: {
    bg: "bg-transparent",
    border: "border-gray-300",
    text: "text-gray-500",
    activeBg: "bg-red-50",
    activeBorder: "border-red-200",
    activeText: "text-red-600",
  },
};

function ADLCard({
  adl,
  level,
  onLevelChange,
}: {
  adl: (typeof ADL_CATEGORIES)[number];
  level: AdlLevel | undefined;
  onLevelChange: (id: string, value: AdlLevel) => void;
}) {
  const activeLevelStyle = level
    ? levelStyles[level]
    : null;

  return (
    <div
      className={`bg-white rounded-lg p-4 transition-all border ${
        activeLevelStyle
          ? activeLevelStyle.activeBorder
          : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{adl.icon}</span>
        <span className="text-[15px] font-semibold text-foreground">
          {adl.label}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3 leading-snug">
        {adl.description}
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {ADL_LEVELS.map((lvl) => {
          const isActive = level === lvl.value;
          const style = levelStyles[lvl.value];
          return (
            <button
              key={lvl.value}
              type="button"
              onClick={() => onLevelChange(adl.id, lvl.value as AdlLevel)}
              className={`px-3 py-1.5 text-sm rounded-md border cursor-pointer transition-all whitespace-nowrap ${
                isActive
                  ? `${style.activeBg} ${style.activeBorder} ${style.activeText} font-semibold`
                  : `${style.bg} ${style.border} ${style.text}`
              }`}
            >
              {lvl.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepAdlAssessment({ data, setData }: StepProps) {
  const setLevel = (id: string, value: AdlLevel) => {
    setData({ ...data, adlLevels: { ...data.adlLevels, [id]: value } });
  };

  const answered = Object.keys(data.adlLevels).length;
  const total = ADL_CATEGORIES.length;

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1.5">
        Activities of Daily Living
      </h2>
      <p className="text-[15px] text-gray-500 mb-7 leading-relaxed">
        For each activity, tell us how much help is needed right now. Be honest
        — this directly affects how many hours you can receive.
      </p>

      <div className="flex items-start gap-2.5 p-3 px-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
        <ClipboardList className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          Think about a typical day. If help is needed even sometimes, select
          &ldquo;Needs some help.&rdquo; If the task simply can&apos;t be done
          without someone there, select &ldquo;Cannot do without help.&rdquo;
        </p>
      </div>

      <div
        className={`flex items-center justify-between px-4 py-2.5 rounded-lg mb-5 border transition-all ${
          answered === total
            ? "bg-emerald-50 border-emerald-200"
            : "bg-gray-100 border-gray-200"
        }`}
      >
        <span className="text-sm font-medium text-foreground">
          {answered === total
            ? "All activities answered"
            : `${answered} of ${total} answered`}
        </span>
        <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(answered / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ADL_CATEGORIES.map((adl) => (
          <ADLCard
            key={adl.id}
            adl={adl}
            level={data.adlLevels[adl.id]}
            onLevelChange={setLevel}
          />
        ))}
      </div>

      <div className="mt-6">
        <Label className="text-[15px] font-medium text-foreground mb-1 block">
          Anything else we should know?
        </Label>
        <p className="text-sm text-gray-500 mb-1.5">
          Any other daily challenges, safety concerns, or details that would
          help your case
        </p>
        <Textarea
          value={data.adlNotes}
          onChange={(e) => setData({ ...data, adlNotes: e.target.value })}
          rows={3}
          placeholder="e.g., 'She wanders at night and has tried to leave the apartment. She also forgets to turn off the stove.'"
        />
      </div>
    </div>
  );
}
