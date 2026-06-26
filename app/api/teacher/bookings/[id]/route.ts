import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/auth';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';
import { loadTeacherCredentials } from '@/lib/teacher-credentials';
import { google } from 'googleapis';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!await getTeacherSession(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;
  const { message } = await request.json().catch(() => ({}));

  let studentEmail: string | undefined;
  let studentName: string;
  let startStr: string;

  // Step 1: fetch event and delete from calendar
  try {
    const calendar = await getCalendar();
    const event = await calendar.events.get({ calendarId: CALENDAR_ID, eventId: id });
    studentEmail = event.data.attendees?.[0]?.email ?? undefined;
    studentName = event.data.summary?.replace(/^Spanish Lesson\s*-\s*/i, '') ?? 'Student';
    startStr = event.data.start?.dateTime
      ? new Date(event.data.start.dateTime).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : event.data.start?.date ?? '';
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: id, sendUpdates: 'all' });
  } catch (err) {
    console.error('Cancel: calendar error', err);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }

  // Step 2: send Gmail — best-effort, never blocks the cancellation
  if (studentEmail && message?.trim()) {
    try {
      const creds = await loadTeacherCredentials();
      if (!creds) throw new Error('No teacher credentials in Redis — please log out and log in again.');

      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      auth.setCredentials({ refresh_token: creds.refreshToken });
      const gmail = google.gmail({ version: 'v1', auth });

      const note = `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;margin:12px 0">${message.trim()}</blockquote>`;
      const html = `<p>Hi ${studentName!},</p><p>Your Spanish lesson scheduled for <strong>${startStr!}</strong> has been cancelled by your teacher.</p><p><strong>Message from your teacher:</strong></p>${note}<p>You can book a new lesson at <a href="${BASE_URL}">${BASE_URL}</a>.</p>`;
      const raw = [
        `From: ${creds.email}`,
        `To: ${studentEmail}`,
        `Subject: Your Spanish lesson on ${startStr!} has been cancelled`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html,
      ].join('\r\n');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: Buffer.from(raw).toString('base64url') },
      });

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('Cancel: Gmail error', err);
      const hint = (err as Error).message?.includes('insufficient')
        ? 'Log out and log in again to grant Gmail permission.'
        : 'Email could not be sent.';
      return NextResponse.json({ ok: true, emailError: hint });
    }
  }

  return NextResponse.json({ ok: true });
}
