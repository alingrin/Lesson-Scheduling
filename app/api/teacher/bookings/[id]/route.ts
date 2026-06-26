import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/auth';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';
import nodemailer from 'nodemailer';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER || '';

const mailer =
  process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_PORT === '465',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : null;

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!await getTeacherSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const { message } = await request.json().catch(() => ({}));

  try {
    const calendar = getCalendar();
    const event = await calendar.events.get({ calendarId: CALENDAR_ID, eventId: id });
    const studentEmail = event.data.attendees?.[0]?.email;
    const studentName = event.data.summary?.replace(/^Spanish Lesson\s*-\s*/i, '') ?? 'Student';
    const startStr = event.data.start?.dateTime
      ? new Date(event.data.start.dateTime).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : event.data.start?.date ?? '';

    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: id, sendUpdates: 'all' });

    if (mailer && studentEmail && message?.trim()) {
      const note = `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;margin:12px 0">${message.trim()}</blockquote>`;
      await mailer.sendMail({
        from: FROM_EMAIL,
        to: studentEmail,
        subject: `Your Spanish lesson on ${startStr} has been cancelled`,
        html: `<p>Hi ${studentName},</p><p>Your Spanish lesson scheduled for <strong>${startStr}</strong> has been cancelled by your teacher.</p><p><strong>Message from your teacher:</strong></p>${note}<p>You can book a new lesson at <a href="${BASE_URL}">${BASE_URL}</a>.</p>`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
