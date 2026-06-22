import { DateTime, Interval } from 'luxon';

export const LESSON_MINUTES = parseInt(process.env.LESSON_DURATION_MINUTES || '60', 10);
export const BUFFER_MINUTES = parseInt(process.env.BUFFER_TIME_MINUTES || '10', 10);
export const LEAD_HOURS = parseInt(process.env.LEAD_TIME_HOURS || '24', 10);
export const SLOT_STEP_MINUTES = parseInt(process.env.SLOT_STEP_MINUTES || '15', 10);
export const WORK_DAY_START = parseInt(process.env.WORK_DAY_START || '9', 10);
export const WORK_DAY_END = parseInt(process.env.WORK_DAY_END || '17', 10);

export interface Slot {
  start: string;
  end: string;
}

// Luxon weekday: 1=Mon…7=Sun → JS day: 0=Sun…6=Sat
function luxonToJsDay(luxonWeekday: number): number {
  return luxonWeekday % 7;
}

export function generateCandidateSlots(
  startDate: DateTime,
  days: number,
  startHour = WORK_DAY_START,
  endHour = WORK_DAY_END,
  workDays: number[] = [1, 2, 3, 4, 5],
  workTimezone = 'UTC',
): Slot[] {
  const slots: Slot[] = [];
  // Anchor to the work timezone so hours 9–17 mean 9–17 in the teacher's local time
  const workStart = startDate.setZone(workTimezone).startOf('day');
  for (let d = 0; d < days; d++) {
    const day = workStart.plus({ days: d });
    if (!workDays.includes(luxonToJsDay(day.weekday))) continue;
    const latestEnd = day.set({ hour: endHour, minute: 0, second: 0, millisecond: 0 });
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += SLOT_STEP_MINUTES) {
        const start = day.set({ hour, minute, second: 0, millisecond: 0 });
        const end = start.plus({ minutes: LESSON_MINUTES });
        if (end > latestEnd || end <= start) continue;
        slots.push({ start: start.toUTC().toISO()!, end: end.toUTC().toISO()! });
      }
    }
  }
  return slots;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Interval.fromISO(`${aStart}/${aEnd}`).overlaps(Interval.fromISO(`${bStart}/${bEnd}`));
}

export function filterAvailable(candidates: Slot[], busy: { start: string; end: string }[]): Slot[] {
  const leadLimit = DateTime.utc().plus({ hours: LEAD_HOURS });
  return candidates.filter((s) => {
    if (DateTime.fromISO(s.start) < leadLimit) return false;
    for (const b of busy) {
      const paddedEnd = DateTime.fromISO(b.end).plus({ minutes: BUFFER_MINUTES }).toISO()!;
      if (overlaps(s.start, s.end, b.start, paddedEnd)) return false;
    }
    return true;
  });
}
