import { z } from 'zod';

export const CONTRACT_VERSION = '0.1.0' as const;
export const contractVersionSchema = z.literal(CONTRACT_VERSION);

export const opaqueReferenceSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0, 'Reference must not be blank');

export const unitCodeSchema = opaqueReferenceSchema;
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'Use an explicit three-letter uppercase code');

export const quantitySchema = z
  .object({
    value: z.string().regex(/^\d+(?:\.\d+)?$/, 'Use a non-negative decimal string without exponent notation'),
    unitCode: unitCodeSchema,
  })
  .strict();

export type Quantity = z.infer<typeof quantitySchema>;

export const moneySchema = z
  .object({
    minorUnits: z.string().regex(/^-?(?:0|[1-9]\d*)$/, 'Use a signed integer string'),
    currencyCode: currencyCodeSchema,
    minorUnitScale: z.number().int().nonnegative().safe(),
  })
  .strict();

export type Money = z.infer<typeof moneySchema>;

export interface PrecheckEvidence {
  readonly hardRules: 'PASS' | 'FAIL';
  readonly authorization: 'ACTIVE' | 'DENIED';
  readonly approval: 'VALID' | 'REVOKED' | 'EXPIRED';
  readonly draftSnapshot: 'CURRENT' | 'STALE';
  readonly policy: 'CURRENT' | 'STALE';
  readonly idempotencyKey: 'PRESENT' | 'MISSING';
}

export function passesPrecheck(evidence: PrecheckEvidence | undefined): boolean {
  return evidence !== undefined
    && evidence.hardRules === 'PASS'
    && evidence.authorization === 'ACTIVE'
    && evidence.approval === 'VALID'
    && evidence.draftSnapshot === 'CURRENT'
    && evidence.policy === 'CURRENT'
    && evidence.idempotencyKey === 'PRESENT';
}

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isCalendarDate, 'Date must be a real calendar date');

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isSupportedTimeZone, 'Provide a recognized time zone');

export const instantSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
    'Use an RFC 3339 timestamp with an explicit offset',
  )
  .refine(isInstant, 'Timestamp must be valid and have a known offset');

export type DateOnly = z.infer<typeof dateOnlySchema>;
export type Instant = z.infer<typeof instantSchema>;

export function decimalParts(value: string): { readonly whole: string; readonly fraction: string } {
  const [whole = '0', fraction = ''] = value.split('.');
  return { whole, fraction };
}

export function decimalToScaledInteger(value: string, scale: number): bigint {
  const { whole, fraction } = decimalParts(value);
  const paddedFraction = fraction.padEnd(scale, '0');
  return BigInt(`${whole}${paddedFraction}`);
}

export function decimalScale(value: string): number {
  return decimalParts(value).fraction.length;
}

export function decimalSumEquals(total: string, parts: readonly string[]): boolean {
  const scale = Math.max(decimalScale(total), ...parts.map(decimalScale));
  return decimalToScaledInteger(total, scale) === parts.reduce(
    (sum, part) => sum + decimalToScaledInteger(part, scale),
    0n,
  );
}

export function compareDateOnly(left: string, right: string): -1 | 0 | 1 {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareInstants(left: string, right: string): -1 | 0 | 1 {
  const leftParts = parseInstantParts(left);
  const rightParts = parseInstantParts(right);

  if (leftParts.epochSeconds !== rightParts.epochSeconds) {
    return leftParts.epochSeconds < rightParts.epochSeconds ? -1 : 1;
  }

  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftFraction = leftParts.fraction.padEnd(scale, '0');
  const rightFraction = rightParts.fraction.padEnd(scale, '0');
  return leftFraction < rightFraction ? -1 : leftFraction > rightFraction ? 1 : 0;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= (monthDays[month - 1] ?? 0);
}

function isSupportedTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isInstant(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (match === null || !isCalendarDate(match[1] ?? '')) return false;

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4]);
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (match[5] !== 'Z') {
    const offsetHour = Number(match[7]);
    const offsetMinute = Number(match[8]);
    if (offsetHour > 23 || offsetMinute > 59) return false;
    if (match[6] === '-' && offsetHour === 0 && offsetMinute === 0) return false;
  }
  return true;
}

function parseInstantParts(value: string): { readonly epochSeconds: number; readonly fraction: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (match === null) throw new Error('Invalid RFC 3339 instant');

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === 'Z' ? 0 : Number(match[10]);
  const offsetMinute = match[8] === 'Z' ? 0 : Number(match[11]);
  const offsetSign = match[9] === '-' ? -1 : 1;
  const localSeconds = daysFromCivil(year, month, day) * 86_400 + hour * 3_600 + minute * 60 + second;
  const offsetSeconds = offsetSign * (offsetHour * 3_600 + offsetMinute * 60);

  return {
    epochSeconds: localSeconds - offsetSeconds,
    fraction: (match[7] ?? '').replace(/0+$/, ''),
  };
}

function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}
