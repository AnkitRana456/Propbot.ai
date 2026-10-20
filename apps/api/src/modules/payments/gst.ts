import { GST_RATE_PERCENT, type GstBreakdown } from '@propbot/shared';

/** State code of the seller (your PropBot entity), used to decide CGST+SGST versus IGST. */
export const sellerStateCode = () => process.env.SELLER_GST_STATE_CODE ?? '29';

/**
 * GST-inclusive split: `grossMinor` is what the customer paid. Same-state supplies split the tax into CGST + SGST,
 * everything else (including an unknown buyer state) is IGST. All figures are in paise and add up exactly.
 */
export function computeGst(grossMinor: number, buyerStateCode?: string | null, seller = sellerStateCode()): GstBreakdown {
  const gross = Math.max(0, Math.round(grossMinor));
  const taxable = Math.round((gross * 100) / (100 + GST_RATE_PERCENT));
  const total = gross - taxable;
  if (buyerStateCode && buyerStateCode === seller) {
    const cgst = Math.floor(total / 2);
    return { taxableMinor: taxable, totalTaxMinor: total, cgstMinor: cgst, sgstMinor: total - cgst, igstMinor: 0, kind: 'intra_state' };
  }
  return { taxableMinor: taxable, totalTaxMinor: total, cgstMinor: 0, sgstMinor: 0, igstMinor: total, kind: 'inter_state' };
}
