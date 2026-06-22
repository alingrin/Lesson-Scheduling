export function getDefaultTZ() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; }
}

export function formatDateForTZ(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function startOfWeekInTZ(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  const weekday = parts.find((p) => p.type === 'weekday')!.value;
  const dt = new Date(`${year}-${month}-${day}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday));
  return dt;
}

export function todayInTZ(timeZone: string): Date {
  const s = formatDateForTZ(new Date(), timeZone);
  return new Date(`${s}T12:00:00Z`);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function dayKeyForISO(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone });
}

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12));
}

export function getTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
  return ['UTC', 'Europe/London', 'Europe/Madrid', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];
}
