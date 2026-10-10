/** A local calendar day in the device's timezone, as `YYYY-MM-DD`. */
export type LocalDate = string;

const pad = (value: number): string => String(value).padStart(2, '0');

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 86400000;

function parseLocalDate(date: LocalDate): [number, number, number] {
  const match = LOCAL_DATE_PATTERN.exec(date);

  if (match === null) {
    throw new RangeError(`Invalid local date "${date}", expected YYYY-MM-DD`);
  }

  const [, yearStr, monthStr, dayStr] = match;

  if (yearStr === undefined || monthStr === undefined || dayStr === undefined) {
    throw new RangeError(`Invalid local date "${date}", expected YYYY-MM-DD`);
  }

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const utc = new Date(Date.UTC(year, month - 1, day));

  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar day "${date}", expected a real date`);
  }

  return [year, month - 1, day];
}

function formatUtc(date: Date): LocalDate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The calendar day a `Date` falls on in the device's local timezone. */
export function toLocalDate(d: Date): LocalDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO 8601 timestamp in local time with its numeric UTC offset; never `Z`. */
export function toTimestamp(d: Date): string {
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absOffset = Math.abs(offsetMinutes);

  const offset = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;

  return (
    `${toLocalDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` + offset
  );
}

/** `date` shifted by `n` days; `n` may be negative. Never reads the clock. */
export function addDays(date: LocalDate, n: number): LocalDate {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Days to add must be an integer, received ${n}`);
  }

  const [year, month, day] = parseLocalDate(date);
  const utc = new Date(Date.UTC(year, month, day));
  utc.setUTCDate(utc.getUTCDate() + n);

  return formatUtc(utc);
}

/** Whole days from `a` to `b`: `b − a`, negative when `b` is before `a`. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [yearA, monthA, dayA] = parseLocalDate(a);
  const [yearB, monthB, dayB] = parseLocalDate(b);

  return Math.round((Date.UTC(yearB, monthB, dayB) - Date.UTC(yearA, monthA, dayA)) / MS_PER_DAY);
}

/** Every day from `from` inclusive up to `toExclusive`; empty when `from >= toExclusive`. */
export function eachDay(from: LocalDate, toExclusive: LocalDate): LocalDate[] {
  const count = daysBetween(from, toExclusive);

  if (count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/** The Monday of the week `date` falls in, using UTC weekday arithmetic. */
export function weekStart(date: LocalDate): LocalDate {
  const [year, month, day] = parseLocalDate(date);
  const utc = new Date(Date.UTC(year, month, day));
  const daysSinceMonday = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - daysSinceMonday);

  return formatUtc(utc);
}
