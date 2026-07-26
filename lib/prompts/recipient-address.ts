import { formatMltcAddress, type MltcAddress } from "@/lib/mltc-addresses";

/**
 * Marker the tests assert on, so a regression can't silently reintroduce
 * bracketed placeholder addresses like "[UnitedHealthcare Address]".
 */
export const NO_ADDRESS_INSTRUCTION =
  "We do not have a verified mailing address for this plan. Omit the recipient address block entirely — write the letter with no address under the plan name. Do NOT invent an address and do NOT write a placeholder such as [Plan Address].";

/**
 * Builds the RECIPIENT ADDRESS section of a letter prompt.
 *
 * When we have a verified address the model is told to reproduce it verbatim.
 * When we do not, it is told to leave the address block out rather than emit a
 * bracketed placeholder — a missing address is better than a fake one.
 */
export function buildRecipientAddressSection(
  address: MltcAddress | null,
  recipientDescription: string
): string {
  if (!address) {
    return `RECIPIENT ADDRESS: unknown.\n${NO_ADDRESS_INSTRUCTION}`;
  }

  const fax = address.fax ? `\nFax (for reference only): ${address.fax}` : "";

  return `RECIPIENT ADDRESS (${recipientDescription}) — reproduce these lines verbatim as the address block under the date, exactly as written and with no additions:
${formatMltcAddress(address)}${fax}`;
}
