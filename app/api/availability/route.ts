import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';
import { generateCandidateSlots, filterAvailable } from '@/lib/slots';
import { readExposedSlots } from '@/lib/exposed-slots';
import { getTeacherSession } from '@/lib/auth';
import { readSettings } from '@/lib/settings';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const tz = searchParams.get('tz') || 'UTC';
    const teacherView = searchParams.get('teacher') === 'true';

    if (teacherView && !await getTeacherSession(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const calendar = getCalendar();
    const rawStart = searchParams.get('start');
    const requestedStart = rawStart ? DateTime.fromISO(rawStart, { zone: tz }) : null;
    const startDate = requestedStart?.isValid
      ? requestedStart.startOf('day')
      : DateTime.now().setZone(tz).startOf('day');

    const timeMin = startDate.toUTC().toISO()!;
    const timeMax = startDate.plus({ days }).toUTC().toISO()!;

    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: { timeMin, timeMax, items: [{ id: CALENDAR_ID }] },
    });

    const busy = (freeBusyResponse.data.calendars ?? {})[CALENDAR_ID]?.busy ?? [];

    const settings = await readSettings();
    const candidates = generateCandidateSlots(startDate, days, settings.workDayStart, settings.workDayEnd, settings.workDays, settings.workTimezone);
    const available = filterAvailable(candidates, busy as { start: string; end: string }[]);

    if (teacherView) {
      return NextResponse.json({ timezone: tz, slots: available });
    }

    const exposed = await readExposedSlots();
    const filtered = exposed.length > 0
      ? available.filter((s) => exposed.some((e) => e.start === s.start && e.end === s.end))
      : available;

    return NextResponse.json({ timezone: tz, slots: filtered });
  } catch (err: unknown) {
    console.error(err);
    const detail = (err as { response?: { data?: { error?: { message?: string } } }; message?: string })
      ?.response?.data?.error?.message ?? (err as Error)?.message ?? '';
    return NextResponse.json(
      { error: `Failed to compute availability${detail ? ': ' + detail : ''}` },
      { status: 500 },
    );
  }
}
