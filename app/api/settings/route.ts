import { NextRequest, NextResponse } from 'next/server';
import { checkTeacherToken } from '@/lib/auth';
import { readSettings, writeSettings, TeacherSettings } from '@/lib/settings';

export async function GET(request: NextRequest) {
  if (!checkTeacherToken(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await readSettings());
}

export async function POST(request: NextRequest) {
  if (!checkTeacherToken(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json() as Partial<TeacherSettings>;
    const current = await readSettings();
    const next: TeacherSettings = {
      workDayStart: typeof body.workDayStart === 'number' ? body.workDayStart : current.workDayStart,
      workDayEnd: typeof body.workDayEnd === 'number' ? body.workDayEnd : current.workDayEnd,
      workDays: Array.isArray(body.workDays) ? body.workDays : current.workDays,
      workTimezone: typeof body.workTimezone === 'string' && body.workTimezone ? body.workTimezone : current.workTimezone,
    };
    if (next.workDayStart >= next.workDayEnd) return NextResponse.json({ error: 'Start must be before end' }, { status: 400 });
    if (next.workDays.length === 0) return NextResponse.json({ error: 'Select at least one work day' }, { status: 400 });
    await writeSettings(next);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
