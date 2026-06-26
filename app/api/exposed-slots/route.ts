import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/auth';
import { readExposedSlots, writeExposedSlots } from '@/lib/exposed-slots';
import { Slot } from '@/lib/slots';

export async function GET(request: NextRequest) {
  if (!await getTeacherSession(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const slots = await readExposedSlots();
  return NextResponse.json({ slots });
}

export async function POST(request: NextRequest) {
  if (!await getTeacherSession(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { slots } = await request.json();
    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: 'Missing slots array' }, { status: 400 });
    }
    const normalized: Slot[] = slots
      .filter((s): s is Slot => s && typeof s.start === 'string' && typeof s.end === 'string')
      .map(({ start, end }) => ({ start, end }));
    await writeExposedSlots(normalized);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to save exposed slots' }, { status: 500 });
  }
}
