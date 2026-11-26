import { z } from 'zod';
import {
  compareDateOnly,
  compareInstants,
  dateOnlySchema,
  instantSchema,
  timeZoneSchema,
} from '../shared/primitives.js';

export const expirySchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('DATE_ONLY'), value: dateOnlySchema, timeZone: timeZoneSchema }).strict(),
  z.object({ basis: z.literal('INSTANT'), value: instantSchema }).strict(),
]);

export type Expiry = z.infer<typeof expirySchema>;

export const qualityStatusSchema = z.enum(['PASS', 'FAIL', 'UNKNOWN']);
export type QualityStatus = z.infer<typeof qualityStatusSchema>;

export const asOfSchema = z.discriminatedUnion('basis', [
  z.object({ basis: z.literal('DATE_ONLY'), value: dateOnlySchema, timeZone: timeZoneSchema }).strict(),
  z.object({ basis: z.literal('INSTANT'), value: instantSchema }).strict(),
]);

export type AsOf = z.infer<typeof asOfSchema>;

const sellabilityInputSchema = z.object({
  expiry: expirySchema.optional(),
  asOf: asOfSchema.optional(),
  qualityStatus: qualityStatusSchema.optional(),
}).strict();

export type SellabilityAssessment =
  | { readonly status: 'ELIGIBLE'; readonly reason: 'BEFORE_EXPIRY_AND_QUALITY_PASS' }
  | { readonly status: 'BLOCKED'; readonly reason: 'AFTER_EXPIRY' | 'QUALITY_FAILED' }
  | { readonly status: 'UNRESOLVED'; readonly reason: 'MISSING_INPUT' | 'UNKNOWN_QUALITY' | 'BASIS_MISMATCH' | 'EXPIRY_BOUNDARY' | 'INVALID_INPUT' };

export function assessSellability(input: unknown): SellabilityAssessment {
  const parsed = sellabilityInputSchema.safeParse(input);
  if (!parsed.success) return { status: 'UNRESOLVED', reason: 'INVALID_INPUT' };

  const { expiry, asOf, qualityStatus } = parsed.data;
  if (qualityStatus === 'FAIL') return { status: 'BLOCKED', reason: 'QUALITY_FAILED' };
  if (qualityStatus === 'UNKNOWN') return { status: 'UNRESOLVED', reason: 'UNKNOWN_QUALITY' };
  if (expiry === undefined || asOf === undefined || qualityStatus === undefined) {
    return { status: 'UNRESOLVED', reason: 'MISSING_INPUT' };
  }
  if (expiry.basis !== asOf.basis) return { status: 'UNRESOLVED', reason: 'BASIS_MISMATCH' };

  if (expiry.basis === 'DATE_ONLY' && asOf.basis === 'DATE_ONLY') {
    if (expiry.timeZone !== asOf.timeZone) return { status: 'UNRESOLVED', reason: 'BASIS_MISMATCH' };
    return assessComparison(compareDateOnly(asOf.value, expiry.value));
  }

  if (expiry.basis === 'INSTANT' && asOf.basis === 'INSTANT') {
    return assessComparison(compareInstants(asOf.value, expiry.value));
  }

  return { status: 'UNRESOLVED', reason: 'BASIS_MISMATCH' };
}

function assessComparison(comparison: -1 | 0 | 1): SellabilityAssessment {
  if (comparison < 0) return { status: 'ELIGIBLE', reason: 'BEFORE_EXPIRY_AND_QUALITY_PASS' };
  if (comparison > 0) return { status: 'BLOCKED', reason: 'AFTER_EXPIRY' };
  return { status: 'UNRESOLVED', reason: 'EXPIRY_BOUNDARY' };
}
