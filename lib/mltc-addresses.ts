import type { MltcPlanValue } from "@/lib/constants";

/**
 * Mailing addresses for every MLTC plan in `MLTC_PLANS`, selectable or retired.
 *
 * These addresses end up on formal legal correspondence sent by vulnerable
 * clients, so the rule for this file is: only record an address that has been
 * read out of the plan's own current member handbook or member-facing website.
 * Never guess, never "fill in" a plausible-looking address. A plan with no
 * verified address MUST be recorded as `null` below — the prompt builders then
 * instruct the model to omit the recipient address block entirely, which is far
 * better than shipping a letter to an address nobody checks.
 *
 * Every entry carries the source URL and the date it was checked so the table
 * can be re-verified. Plans move; re-check anything older than ~12 months.
 */

export type { MltcPlanValue };

export interface MltcAddress {
  /** Recipient block, one line per output line, ready to print on a letter. */
  lines: readonly string[];
  /** Fax for this department, only when the plan publishes one. */
  fax?: string;
}

export interface MltcPlanContacts {
  /**
   * Where a Stage 1 request for increase (a service authorization /
   * concurrent review request) should be mailed.
   */
  correspondence: MltcAddress;
  /**
   * Where a Stage 2 internal appeal should be mailed, when the plan routes
   * appeals somewhere different. Absent means "same as correspondence".
   */
  appeals?: MltcAddress;
}

/**
 * Keyed on the exact `value`s in `MLTC_PLANS` so a new plan cannot be added
 * without a decision being recorded here (see the unit tests). Retired plans
 * are keyed too — a historical case still needs a lookup that resolves.
 * `null` means "deliberately unknown" — the reason is in the comment above it.
 */
export const MLTC_PLAN_CONTACTS: Record<MltcPlanValue, MltcPlanContacts | null> =
  {
    // Aetna Better Health of New York — still an active NY MLTC partial-cap plan
    // per the NYS DOH consumer guide (pub. 3339, rev. 10/25).
    // Member Services address and appeals fax: 2024 MLTC Member Handbook
    // (376310-NY-EN rev 6/24), "Helpful Information" table.
    // Appeals PO Box: same handbook, "How do I Contact my Plan to file an Appeal?".
    // Source: https://www.aetnabetterhealth.com/content/dam/aetna/medicaid/newyork/pdf/ny_member_handbook.pdf
    //   (aetnabetterhealth.com blocks automated fetches; read via the Internet
    //   Archive capture http://web.archive.org/web/20241126230658id_/<same url>)
    // Checked: 2026-07-26.
    // NOTE: Aetna publishes more than one Cleveland PO Box for member mail
    // (the website used PO Box 81139 in a 2024-07-22 capture; the handbook's
    // "Helpful Information" table lists PO Box 818001 for Grievance & Appeals).
    // We use the box named in the handbook's appeal-filing section.
    aetna: {
      correspondence: {
        lines: [
          "Aetna Better Health of New York",
          "101 Park Avenue, 15th Floor",
          "New York, NY 10178",
        ],
        fax: "1-855-863-6421",
      },
      appeals: {
        lines: [
          "Aetna Better Health of New York",
          "Grievance and Appeals Department",
          "PO Box 81040, 5801 Postal Road",
          "Cleveland, OH 44181",
        ],
        fax: "1-855-264-3822",
      },
    },

    // Anthem Blue Cross and Blue Shield HP — the "Anthem BCBS HealthPlus MLTC"
    // plan in the NYS DOH consumer guides (pub. 3339/3340/3341, rev. 10/25).
    // Service authorization requests go to Care Management; appeals go to
    // Appeals and Grievances at the same street address (that is what the
    // handbook prints — the attention line is the only difference).
    // Source: Member Handbook — Managed Long-Term Care Program,
    //   form 1050124NYMMLABS 05/25, "Requesting Service Authorization" and
    //   "How do I Contact my Plan to file an Appeal?"
    //   https://www.anthembluecross.com/content/dam/digital/docs/anthembluecross/medicaid/new-york/member-handbook-managed-long-term-care-english.pdf
    //   (linked from https://www.anthembluecross.com/ny/medicaid/managed-long-term-care)
    // Checked: 2026-07-26.
    anthem: {
      correspondence: {
        lines: [
          "Anthem Blue Cross and Blue Shield HP",
          "Care Management",
          "1985 Marcus Ave., Ste. 150",
          "Lake Success, NY 11042",
        ],
      },
      appeals: {
        lines: [
          "Anthem Blue Cross and Blue Shield HP",
          "Appeals and Grievances",
          "1985 Marcus Ave., Ste. 150",
          "Lake Success, NY 11042",
        ],
        fax: "718-368-6267",
      },
    },

    // CenterLight Healthcare — note this is now a PACE plan, not an MLTC
    // partial-capitation plan (NYS DOH pub. 3339 rev. 10/25 lists CenterLight
    // only under PACE). The address below is the one CenterLight publishes for
    // participant appeals and grievances.
    // Source: https://www.centerlighthealthcare.org/pace-member-information
    // Checked: 2026-07-26.
    centerlight: {
      correspondence: {
        lines: [
          "CenterLight Healthcare PACE",
          "Appeals and Grievances Department",
          "625 RXR Plaza, Ste 1350",
          "Uniondale, NY 11556",
        ],
      },
    },

    // Centers Plan for Healthy Living MLTC.
    // NOTE ON THE CORRESPONDENCE ADDRESS: the MLTC handbook routes service
    // authorization requests through the member's Care Management Team by phone
    // and prints NO utilization-management mailing address. The address below is
    // the handbook's own inside-cover Member Services address ("If you have
    // questions or need help, please write to us at:") — the only member-
    // correspondence address the MLTC handbook publishes. We did NOT reuse the
    // "Attn: Utilization Management" address from centersplan.com's um_quick_link
    // PDF: that document is a Medicare Advantage one and its routing is
    // unverified for the MLTC line of business.
    // Appeals address is printed twice in the handbook (Section 14 and "How do I
    // Contact my Plan to file an Appeal?"), spelled exactly as reproduced here.
    // Source: Managed Long Term Care Member Handbook, CPHL_MK006_01302017,
    //   rev. 02/2025
    //   https://centersplan.com/wp-content/uploads/2025/06/cph_mltc_mhb_e25_156259_2025_mltc_member_handbook_en_042325_proof.pdf
    // Checked: 2026-07-26.
    centers_plan: {
      correspondence: {
        lines: [
          "Centers Plan for Healthy Living",
          "75 Vanderbilt Ave, Suite 700",
          "Staten Island, NY 10304",
        ],
      },
      appeals: {
        lines: [
          "Centers Plan for Healthy Living",
          "Attention: Grievances and Appeals Department",
          "75 Vanderbilt Ave. Suite 700",
          "Staten Island, NY 10304",
        ],
        fax: "1-347-505-7089",
      },
    },

    // Elderplan / HomeFirst MLTC. Service authorization requests go to
    // Coordinated Care; appeals go to Appeals and Grievances.
    // Source: HomeFirst Managed Long Term Care Plan Member Handbook 2025
    //   https://www.elderplan.org/files/2025_hf_mltc_member_handbook_v3_09-19-25_accessible/
    // Checked: 2026-07-26.
    elderplan: {
      correspondence: {
        lines: [
          "HomeFirst",
          "Attn: Coordinated Care",
          "55 Water Street, 46th Floor",
          "New York, NY 10041",
        ],
      },
      appeals: {
        lines: [
          "HomeFirst",
          "Attn: Appeals and Grievances",
          "55 Water Street, 46th Floor",
          "New York, NY 10041",
        ],
      },
    },

    // Fidelis Care at Home. The handbook gives one address for both filing a
    // complaint and filing an appeal of an action.
    // Source: Fidelis Care at Home MLTC Member Handbook
    //   https://www.fideliscare.org/Portals/0/Members/Fidelis-Care-at-Home-MLTC-Member-Handbook.Pdf
    // Checked: 2026-07-26.
    fidelis: {
      correspondence: {
        lines: [
          "Fidelis Care at Home",
          "31 British American Boulevard",
          "Latham, NY 12110",
        ],
      },
    },

    // Hamaspik Choice, Inc. MLTC. The handbook sends BOTH written service
    // authorization requests and written plan appeals to Utilization Management,
    // so there is no separate appeals block. (A distinct "Attention: Grievances"
    // line exists, but only for complaints/grievances, which is a different
    // process from an appeal of an action.)
    // Source: MLTC Member Handbook (English), "Service Authorizations, Actions,
    //   and Appeals" and "How do I Contact my Plan to file an Appeal?"
    //   https://www.hamaspik.com/hubfs/MLTC%20Member%20handbook%20march%202024-1.pdf
    //   (linked from https://www.hamaspik.com/members/mltc; hamaspikchoice.org
    //   redirects to hamaspik.com)
    // Checked: 2026-07-26.
    hamaspik: {
      correspondence: {
        lines: [
          "Hamaspik Choice",
          "Attention: Utilization Management",
          "775 N. Main St.",
          "Spring Valley, NY 10977",
        ],
      },
    },

    // Healthfirst — the MLTC product is Senior Health Partners. Requests to
    // increase current services (concurrent review) go to Utilization
    // Management; appeals go to Appeals and Grievances.
    // Source: 2026 Senior Health Partners Member Handbook
    //   https://assets.healthfirst.org/pdf_VCij2K5dJ13n/2026-senior-health-partners-member-handbook-english
    //   (linked from https://healthfirst.org/documents)
    // Checked: 2026-07-26.
    healthfirst: {
      correspondence: {
        lines: [
          "Senior Health Partners (Healthfirst)",
          "Healthfirst Utilization Management",
          "P.O. Box 5166",
          "New York, NY 10274-5166",
        ],
      },
      appeals: {
        lines: [
          "Senior Health Partners Plan",
          "Attn: Appeals and Grievances",
          "P.O. Box 5166",
          "New York, NY 10274-5166",
        ],
      },
    },

    // MetroPlusHealth MLTC. Service authorization requests go to Prior
    // Authorization; appeals go to the Appeals Coordinator at the same address.
    // The handbook writes the correspondence city line as "New York, New York
    // 10004"; we print the two-letter state as the handbook itself does in the
    // appeals paragraph ("50 Water St., New York, NY 10004").
    // Source: MetroPlusHEALTH Managed Long Term Care Member Handbook,
    //   MBR 23.133 (Feb 2024), "Service Authorizations, Actions, and Action
    //   Appeals" and "How do I Contact my Plan to File an Appeal?"
    //   https://metroplus.org/wp-content/uploads/2023/11/MBR-23.133-MLTC-Member-Handbook_FINAL_021424_complete.pdf
    //   (linked from https://metroplus.org/mltc/)
    // Checked: 2026-07-26.
    metroplus: {
      correspondence: {
        lines: [
          "MetroPlusHealth",
          "Attention: Prior Authorization",
          "50 Water Street",
          "New York, NY 10004",
        ],
        fax: "212-908-5282",
      },
      appeals: {
        lines: [
          "MetroPlusHealth",
          "Appeals Coordinator",
          "50 Water St.",
          "New York, NY 10004",
        ],
      },
    },

    // Molina Healthcare's New York MLTC plan is Senior Whole Health of New
    // York. The handbook gives one address for service authorization requests,
    // complaints and appeals.
    // Source: Senior Whole Health of New York 2025 MLTC Member Handbook
    //   https://www.molinahealthcare.com/members/ny/en-us/-/media/Molina/PublicWebsite/PDF/members/ny/en-us/2025-MLTC-Member_Handbook-Final-SenParHan45552.ashx
    //   (linked from https://www.molinahealthcare.com/members/ny/en-us/mem/Swh/member-materials-and-forms.aspx)
    // Checked: 2026-07-26.
    molina: {
      correspondence: {
        lines: [
          "Senior Whole Health of New York",
          "15 MetroTech Center, 11th Floor",
          "Brooklyn, NY 11201",
        ],
      },
    },

    // ElderServe at Home — the plan NYS DOH still lists as "RiverSpring at
    // Home" (riverspringathome.org 301-redirects to elderserveathome.org; same
    // entity, ElderServe Health, Inc., same 1-800-370-3600 line, same street).
    // NOTE: prior authorization is normally handled by the member's Care
    // Manager by phone; the "Service Authorizations" mailing address below is
    // the one the handbook prints in that section for written service
    // authorization correspondence.
    // Source: ElderServe at Home Managed Long Term Care Program Member
    //   Handbook, 2026 Edition
    //   https://elderserveathome.org/wp-content/uploads/2025/12/2026-MLTC-Member-Handbook_EN-Finalv2.pdf
    //   (linked from https://elderserveathome.org/members/member-materials/)
    // Checked: 2026-07-26.
    riverspring: {
      correspondence: {
        lines: [
          "ElderServe at Home",
          "Service Authorizations",
          "80 West 225th St.",
          "Bronx, NY 10463",
        ],
      },
      appeals: {
        lines: [
          "ElderServe at Home",
          "Attn: Quality Department",
          "80 West 225th Street",
          "Bronx, NY 10463",
        ],
      },
    },

    // Same plan as `molina` above — the intake offers both labels. Verified
    // from the same 2025 Senior Whole Health of New York MLTC Member Handbook.
    // Checked: 2026-07-26.
    senior_whole: {
      correspondence: {
        lines: [
          "Senior Whole Health of New York",
          "15 MetroTech Center, 11th Floor",
          "Brooklyn, NY 11201",
        ],
      },
    },

    // VillageCareMAX MLTC.
    // IMPORTANT: the plan moved offices and its handbook body text is stale —
    // the 2026 handbook PDF still says "112 Charles St, New York, NY 10014",
    // while the plan's own current member-facing pages (and the Notice of
    // Non-Discrimination bound into that same PDF) give 120 Broadway. We use
    // the current pages. Re-check if the handbook body is ever reissued.
    // Sources (both first-party, both more recently updated than the handbook
    //   body): https://www.villagecaremax.org/contact-us ("Mailing Address",
    //   page last updated 05/01/2026) for correspondence;
    //   https://www.villagecaremax.org/mltc/members ("To file a complaint or to
    //   appeal a plan action ... Or write to:", page last updated 06/23/2026)
    //   for appeals.
    // Checked: 2026-07-26.
    villagecaremax: {
      correspondence: {
        lines: [
          "VillageCareMAX",
          "120 Broadway, Suite 2840",
          "New York, NY 10271",
        ],
      },
      appeals: {
        lines: [
          "VillageCareMAX",
          "Quality Assurance Department",
          "120 Broadway, Suite 2840",
          "New York, NY 10271",
        ],
        fax: "1-347-226-5180",
      },
    },

    // VNS Health MLTC (formerly VNSNY CHOICE). Service authorization requests
    // go to Medical Management; appeals go to a separate PO Box.
    // Source: VNS Health MLTC Member Handbook (DOH-approved 01.26.26)
    //   https://www.vnshealthplans.org/wp-content/uploads/2024/05/MLTC_Member-Handbook_EN_DOH-01.26.26_full-1.pdf
    //   Appeals address corroborated at
    //   https://www.vnshealthplans.org/mltc-grievances-and-appeals/
    // Checked: 2026-07-26.
    vnsny: {
      correspondence: {
        lines: [
          "VNS Health MLTC",
          "Health Plans - Medical Management Department",
          "220 East 42nd Street",
          "New York, NY 10017",
        ],
      },
      appeals: {
        lines: [
          "VNS Health",
          "Health Plans - Grievance & Appeals",
          "P.O. Box 445",
          "Elmsford, NY 10523",
        ],
      },
    },

    // DELIBERATELY UNKNOWN — GuildNet closed its MLTC plan and no longer
    // appears in the NYS DOH plan directory. Any address we printed would send
    // a client's letter nowhere.
    // Sources: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25,
    //   GuildNet absent); http://health.wnylc.com/health/entry/179/ ("CLOSED").
    // Checked: 2026-07-26.
    guildnet: null,

    // DELIBERATELY UNKNOWN — Independence Care System closed its MLTC plan and
    // converted to a health home; it is not in the NYS DOH plan directory.
    // Sources: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25);
    //   http://health.wnylc.com/health/entry/179/ ("CLOSED (now a health home)").
    // Checked: 2026-07-26.
    independence: null,

    // DELIBERATELY UNKNOWN — UnitedHealthcare Personal Assist, UnitedHealth's
    // NY MLTC plan, closed 9/1/2019 and UnitedHealthcare is absent from the
    // current NYS DOH MLTC plan directory. UnitedHealthcare's national
    // correspondence addresses are for other products and would misroute an
    // MLTC service request, so nothing is recorded.
    // Sources: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25);
    //   http://health.wnylc.com/health/entry/179/ ("CLOSED 9/1/19").
    // Checked: 2026-07-26.
    unitedhealth: null,

    // DELIBERATELY UNKNOWN — there is no WellCare-branded MLTC plan in the
    // current NYS DOH directory; WellCare's NY business sits under the
    // Wellcare Fidelis brand and only the MAP product carries the name. Which
    // entity a self-described "WellCare" member is actually enrolled in cannot
    // be determined from the plan name alone.
    // Sources: https://www.health.ny.gov/publications/3339.pdf (rev. 10/25);
    //   https://nymedicaidchoice.com/content/dam/digital/united-states/new-york/ny-eb/content-docs/MLTC-PLANS-NYC-E-0124%201-31-24.pdf
    // Checked: 2026-07-26.
    wellcare: null,

    // DELIBERATELY UNKNOWN — "Other" is a free-choice escape hatch on the
    // intake form; by definition we do not know which plan the client means.
    other: null,
  };

/** Narrowing helper: is this string one of the intake's MLTC option values? */
export function isMltcPlanValue(value: string): value is MltcPlanValue {
  return Object.prototype.hasOwnProperty.call(MLTC_PLAN_CONTACTS, value);
}

function contactsFor(mltc: string): MltcPlanContacts | null {
  return isMltcPlanValue(mltc) ? MLTC_PLAN_CONTACTS[mltc] : null;
}

/**
 * Address for Stage 1 correspondence (a request for more hours).
 * Returns `null` when the plan is unknown or unverified — callers must handle
 * that by omitting the address block, never by inventing one.
 */
export function getMltcCorrespondenceAddress(mltc: string): MltcAddress | null {
  return contactsFor(mltc)?.correspondence ?? null;
}

/**
 * Address for a Stage 2 internal appeal. Falls back to the correspondence
 * address for plans that publish a single address for both.
 */
export function getMltcAppealsAddress(mltc: string): MltcAddress | null {
  const contacts = contactsFor(mltc);
  if (!contacts) return null;
  return contacts.appeals ?? contacts.correspondence;
}

/** Renders an address block as plain text lines for a prompt or a letter. */
export function formatMltcAddress(address: MltcAddress): string {
  return address.lines.join("\n");
}
