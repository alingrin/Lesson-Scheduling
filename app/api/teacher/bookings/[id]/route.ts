import { NextRequest, NextResponse } from 'next/server';
import { getTeacherSession } from '@/lib/auth';
import { getCalendar, CALENDAR_ID } from '@/lib/calendar';
import { google } from 'googleapis';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getTeacherSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

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

    if (studentEmail && message?.trim()) {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );
      auth.setCredentials({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      const gmail = google.gmail({ version: 'v1', auth });

      const note = `<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#555;margin:12px 0">${message.trim()}</blockquote>`;
      const html = `<p>Hi ${studentName},</p><p>Your Spanish lesson scheduled for <strong>${startStr}</strong> has been cancelled by your teacher.</p><p><strong>Message from your teacher:</strong></p>${note}<p>You can book a new lesson at <a href="${BASE_URL}">${BASE_URL}</a>.</p>`;

      const raw = [
        `To: ${studentEmail}`,
        `Subject: Your Spanish lesson on ${startStr} has been cancelled`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        html,
      ].join('\r\n');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: Buffer.from(raw).toString('base64url') },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
