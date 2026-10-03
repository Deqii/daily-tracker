const pad = (value: number): string => String(value).padStart(2, '0');

export function formatLocalIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
