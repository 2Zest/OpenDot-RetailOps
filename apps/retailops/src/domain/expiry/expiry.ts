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

export type SellabilityAssessment =
  | { readonly status: 'ELIGIBLE'; readonly reason: 'BEFORE_EXPIRY_AND_QUALITY_PASS' }
  | { readonly status: 'BLOCKED'; readonly reason: 'AFTER_EXPIRY' | 'QUALITY_FAILED' }
  | { readonly status: 'UNRESOLVED'; readonly reason: 'MISSING_INPUT' | 'UNKNOWN_QUALITY' | 'BASIS_MISMATCH' | 'EXPIRY_BOUNDARY' };

export function assessSellability(input: {
  readonly expiry?: Expiry;
  readonly asOf?: AsOf;
  readonly qualityStatus?: QualityStatus;
}): SellabilityAssessment {
  if (input.qualityStatus === 'FAIL') return { status: 'BLOCKED', reason: 'QUALITY_FAILED' };
  if (input.qualityStatus === 'UNKNOWN') return { status: 'UNRESOLVED', reason: 'UNKNOWN_QUALITY' };
  if (input.expiry === undefined || input.asOf === undefined || input.qualityStatus === undefined) {
    return { status: 'UNRESOLVED', reason: 'MISSING_INPUT' };
  }
  if (input.expiry.basis !== input.asOf.basis) return { status: 'UNRESOLVED', reason: 'BASIS_MISMATCH' };

  if (input.expiry.basis === 'DATE_ONLY' && input.asOf.basis === 'DATE_ONLY') {
    if (input.expiry.timeZone !== input.asOf.timeZone) return { status: 'UNRESOLVED', reason: 'BASIS_MISMATCH' };
    return assessComparison(compareDateOnly(input.asOf.value, input.expiry.value));
  }

  if (input.expiry.basis === 'INSTANT' && input.asOf.basis === 'INSTANT') {
    return assessComparison(compareInstants(input.asOf.value, input.expiry.value));
  }

  return { status: 'UNRESOLVED', reason: 'BASIS_MISMATCH' };
}

function assessComparison(comparison: -1 | 0 | 1): SellabilityAssessment {
  if (comparison < 0) return { status: 'ELIGIBLE', reason: 'BEFORE_EXPIRY_AND_QUALITY_PASS' };
  if (comparison > 0) return { status: 'BLOCKED', reason: 'AFTER_EXPIRY' };
  return { status: 'UNRESOLVED', reason: 'EXPIRY_BOUNDARY' };
}
