import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MLTC_OPTIONS,
  MLTC_PLANS,
  getMltcLabel,
  getMltcRetirement,
} from "@/lib/constants";
import {
  MLTC_PLAN_CONTACTS,
  formatMltcAddress,
  getMltcAppealsAddress,
  getMltcCorrespondenceAddress,
  isMltcPlanValue,
  type MltcPlanValue,
} from "@/lib/mltc-addresses";
import { NO_ADDRESS_INSTRUCTION } from "@/lib/prompts/recipient-address";
import { buildStage1RequestPrompt } from "@/lib/prompts/stage1-request";
import { buildStage2AppealPrompt } from "@/lib/prompts/stage2-appeal";
import type { Case, IntakeData } from "@/types";

/** Every value that can be stored in `cases.mltc`, retired plans included. */
const PLAN_VALUES = MLTC_PLANS.map((p) => p.value);

/** Only the plans a new intake may choose. */
const SELECTABLE_VALUES = MLTC_OPTIONS.map((o) => o.value);

// Plans we deliberately left unverified. Keeping this list in the test means
// adding an address (or removing a plan) forces the list to be updated, so a
// gap can never appear silently.
const KNOWN_UNKNOWN: MltcPlanValue[] = [
  "guildnet",
  "independence",
  "unitedhealth",
  "wellcare",
  "other",
];

// Plans taken off the intake form because they no longer operate. Listing them
// here means retiring (or un-retiring) a plan is a deliberate edit.
const RETIRED_VALUES: MltcPlanValue[] = [
  "guildnet",
  "independence",
  "unitedhealth",
  "wellcare",
];

// Real `cases.mltc` values observed in production, including the ones that
// point at plans which have since closed. Every one of these must still
// resolve to a human-readable label — we never rewrite these rows.
const PRODUCTION_MLTC_VALUES = [
  "aetna",
  "centerlight",
  "elderplan",
  "fidelis",
  "guildnet",
  "healthfirst",
  "molina",
  "unitedhealth",
  "vnsny",
];

function makeCase(mltc: string): Case {
  return {
    id: "case-1",
    user_id: "user-1",
    case_number: "GMH-0001",
    current_stage: 1,
    stage_status: "in_progress",
    tier: "self_serve",
    mltc,
    current_hours: 8,
    current_days: 5,
    requested_hours: 12,
    requested_days: 7,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const intake: IntakeData = {
  id: "intake-1",
  case_id: "case-1",
  first_name: "Leah",
  last_name: "Wellerstein",
  dob: "1940-05-02",
  phone: "212-555-0100",
  email: "leah@example.com",
  address: "100 Example St",
  city: "Brooklyn",
  state: "NY",
  zip: "11201",
  conditions: ["Fall Risk / Balance Issues"],
  other_conditions: null,
  change_description: "Two falls in the last month.",
  adl_levels: { bathing: "full_help" },
  adl_notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("MLTC address lookup", () => {
  it("has an entry for every plan, selectable or retired", () => {
    for (const value of PLAN_VALUES) {
      expect(
        Object.prototype.hasOwnProperty.call(MLTC_PLAN_CONTACTS, value),
        `MLTC_PLAN_CONTACTS is missing an entry for "${value}". Add a verified address or an explicit null with a sourced comment.`
      ).toBe(true);
    }
  });

  it("has no entries for plans that are not in MLTC_PLANS", () => {
    for (const key of Object.keys(MLTC_PLAN_CONTACTS)) {
      expect(PLAN_VALUES as readonly string[]).toContain(key);
    }
  });

  it("records every plan as either verified or explicitly unknown", () => {
    const unknown = PLAN_VALUES.filter((v) => MLTC_PLAN_CONTACTS[v] === null);
    expect([...unknown].sort()).toEqual([...KNOWN_UNKNOWN].sort());
  });

  it("never stores a placeholder or empty address line", () => {
    for (const value of PLAN_VALUES) {
      const contacts = MLTC_PLAN_CONTACTS[value];
      if (!contacts) continue;

      const blocks = [contacts.correspondence, contacts.appeals].filter(
        (b) => b !== undefined
      );

      for (const block of blocks) {
        expect(block.lines.length).toBeGreaterThan(1);
        for (const line of block.lines) {
          expect(line.trim()).not.toBe("");
          expect(line).not.toMatch(/[[\]]/);
        }
        // Last line must look like "City, ST 12345" / "City, ST 12345-6789".
        expect(block.lines[block.lines.length - 1]).toMatch(
          /,\s[A-Z]{2}\s\d{5}(-\d{4})?$/
        );
      }
    }
  });

  it("returns null for unverified plans and for values outside the option list", () => {
    for (const value of KNOWN_UNKNOWN) {
      expect(getMltcCorrespondenceAddress(value)).toBeNull();
      expect(getMltcAppealsAddress(value)).toBeNull();
    }
    expect(getMltcCorrespondenceAddress("not_a_plan")).toBeNull();
    expect(getMltcAppealsAddress("")).toBeNull();
    expect(isMltcPlanValue("not_a_plan")).toBe(false);
    expect(isMltcPlanValue("fidelis")).toBe(true);
  });

  it("falls back to the correspondence address when a plan has one address", () => {
    // Fidelis publishes a single address for both complaints and appeals.
    expect(getMltcAppealsAddress("fidelis")).toEqual(
      getMltcCorrespondenceAddress("fidelis")
    );
    // VNS Health routes appeals to a separate PO Box.
    expect(getMltcAppealsAddress("vnsny")).not.toEqual(
      getMltcCorrespondenceAddress("vnsny")
    );
  });

  it("formats an address as newline-separated lines", () => {
    const address = getMltcCorrespondenceAddress("fidelis");
    expect(address).not.toBeNull();
    expect(formatMltcAddress(address!)).toBe(
      "Fidelis Care at Home\n31 British American Boulevard\nLatham, NY 12110"
    );
  });
});

describe("prompt builders and the recipient address block", () => {
  it("puts the verified correspondence address in the Stage 1 prompt", () => {
    const prompt = buildStage1RequestPrompt(makeCase("elderplan"), intake);
    expect(prompt).toContain("HomeFirst");
    expect(prompt).toContain("Attn: Coordinated Care");
    expect(prompt).toContain("55 Water Street, 46th Floor");
    expect(prompt).toContain("New York, NY 10041");
    expect(prompt).not.toContain(NO_ADDRESS_INSTRUCTION);
  });

  it("puts the verified appeals address in the Stage 2 prompt", () => {
    const prompt = buildStage2AppealPrompt(
      makeCase("vnsny"),
      intake,
      "IAD text"
    );
    expect(prompt).toContain("Health Plans - Grievance & Appeals");
    expect(prompt).toContain("P.O. Box 445");
    expect(prompt).toContain("Elmsford, NY 10523");
    // The Stage 1 correspondence address must NOT be used for an appeal.
    expect(prompt).not.toContain("220 East 42nd Street");
    expect(prompt).not.toContain(NO_ADDRESS_INSTRUCTION);
  });

  it("tells the model to omit the address block for unverified plans", () => {
    for (const value of KNOWN_UNKNOWN) {
      const stage1 = buildStage1RequestPrompt(makeCase(value), intake);
      const stage2 = buildStage2AppealPrompt(makeCase(value), intake, "IAD");

      for (const prompt of [stage1, stage2]) {
        expect(prompt).toContain("RECIPIENT ADDRESS: unknown.");
        expect(prompt).toContain(NO_ADDRESS_INSTRUCTION);
      }
    }
  });

  it("never asks the model to emit a bracketed address placeholder", () => {
    for (const value of [...PLAN_VALUES, "not_a_plan"]) {
      const prompts = [
        buildStage1RequestPrompt(makeCase(value), intake),
        buildStage2AppealPrompt(makeCase(value), intake, "IAD"),
      ];
      for (const prompt of prompts) {
        // The only bracket we allow anywhere is the literal example inside the
        // "do not write a placeholder such as [Plan Address]" instruction.
        const brackets = prompt.match(/\[[^\]\n]*\]/g) ?? [];
        expect(brackets.every((b) => b === "[Plan Address]")).toBe(true);
      }
    }
  });
});

describe("selectable plans vs. resolvable plans", () => {
  it("resolves every MLTC value seen in production to a non-empty label", () => {
    for (const value of PRODUCTION_MLTC_VALUES) {
      const label = getMltcLabel(value);
      expect(label.trim(), `"${value}" resolved to an empty label`).not.toBe("");
      // A raw slug leaking into the UI is the exact failure we are guarding
      // against, so the label must differ from the stored value.
      expect(label, `"${value}" resolved to its own raw value`).not.toBe(value);
    }
  });

  it("still labels retired plans, which live cases point at", () => {
    for (const value of RETIRED_VALUES) {
      expect(PLAN_VALUES as readonly string[]).toContain(value);
      expect(getMltcLabel(value).trim()).not.toBe("");
    }
  });

  it("falls back to the raw value for a plan it has never heard of", () => {
    expect(getMltcLabel("some_plan_from_2011")).toBe("some_plan_from_2011");
    expect(getMltcLabel("")).toBe("");
  });

  it("offers no retired plan on the intake form", () => {
    for (const value of RETIRED_VALUES) {
      expect(
        SELECTABLE_VALUES,
        `"${value}" is retired but still selectable on the intake form`
      ).not.toContain(value);
    }
  });

  it("marks every retired plan with a reason, and a date when we have one", () => {
    for (const value of RETIRED_VALUES) {
      const retirement = getMltcRetirement(value);
      expect(retirement, `"${value}" has no retirement record`).not.toBeNull();
      expect(retirement!.reason.trim()).not.toBe("");
      // `date` is null when no source establishes one — never a guess.
      if (retirement!.date !== null) {
        expect(retirement!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    expect(getMltcRetirement("unitedhealth")?.date).toBe("2019-09-01");
  });

  it("reports no retirement for a plan that still runs", () => {
    for (const value of SELECTABLE_VALUES) {
      expect(getMltcRetirement(value)).toBeNull();
    }
  });

  it("gives every selectable plan a verified address or an explicit unknown", () => {
    for (const value of SELECTABLE_VALUES) {
      expect(
        Object.prototype.hasOwnProperty.call(MLTC_PLAN_CONTACTS, value),
        `"${value}" is selectable but has no entry in MLTC_PLAN_CONTACTS`
      ).toBe(true);

      const contacts = MLTC_PLAN_CONTACTS[value as MltcPlanValue];
      if (contacts === null) {
        // Deliberately unknown is fine, but it must be a recorded decision.
        expect(KNOWN_UNKNOWN as readonly string[]).toContain(value);
      } else {
        expect(contacts.correspondence.lines.length).toBeGreaterThan(1);
      }
    }
  });
});

describe("MLTC_OPTIONS is never used to look up a label", () => {
  // MLTC_OPTIONS deliberately excludes retired plans, so using it to label a
  // stored `cases.mltc` value silently blanks out historical cases. That is the
  // bug this module exists to prevent; getMltcLabel() is the only correct path.
  const ROOTS = ["app", "components", "lib"];

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...sourceFiles(full));
      } else if (/\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
    return out;
  }

  it("has no MLTC_OPTIONS.find(...) anywhere in the app source", () => {
    const offenders = ROOTS.flatMap(sourceFiles).filter((file) =>
      /MLTC_OPTIONS\s*\.\s*find/.test(readFileSync(file, "utf8"))
    );
    expect(
      offenders,
      "Use getMltcLabel(value) instead — MLTC_OPTIONS omits retired plans."
    ).toEqual([]);
  });
});
