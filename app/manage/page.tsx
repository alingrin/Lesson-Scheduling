'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { addDays, dayKeyForISO, getDefaultTZ, getTimeZones } from '@/components/tz-utils';

interface Slot { start: string; end: string }
interface EventInfo { id: string; summary: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string }; attendees?: { email: string }[]; description?: string }

function ManageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const eventId = searchParams.get('eventId');
  const emailParam = searchParams.get('email');
  const [tz, setTzState] = useState<string>(getDefaultTZ);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try { const saved = localStorage.getItem('calendar_tz'); if (saved) setTzState(saved); } catch {}
  }, []);

  function setTz(newTz: string) {
    try { localStorage.setItem('calendar_tz', newTz); } catch {}
    setTzState(newTz);
  }

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ studentName: '', studentEmail: '', notes: '' });
  const [rescheduleSlots, setRescheduleSlots] = useState<Slot[]>([]);
  const [reschedWeekStart, setReschedWeekStart] = useState<Date>(() => {
    const d = new Date(); d.setUTCHours(12, 0, 0, 0);
    const day = d.getDay(); d.setUTCDate(d.getUTCDate() - day); return d;
  });
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const router = useRouter();

  const apiUrl = token ? `/api/manage/${encodeURIComponent(token)}` : eventId ? `/api/event/${encodeURIComponent(eventId)}` : null;

  const loadEvent = useCallback(async () => {
    if (!apiUrl) { setStatus('No event identifier provided.'); return; }
    const res = await fetch(apiUrl);
    const data = await res.json();
    if (!res.ok) { setStatus(`Error: ${data.error}`); return; }
    const ev: EventInfo = data.event;
    setEvent(ev);
    setForm({
      studentName: ev.summary?.replace(/^Spanish Lesson - /, '') || '',
      studentEmail: (ev.attendees?.[0]?.email) || emailParam || '',
      notes: ev.description?.replace(/^Goals: ?/, '') || '',
    });
  }, [apiUrl, emailParam]);

  const loadReschedule = useCallback(async () => {
    if (!eventId && !token) return;
    const id = event?.id || eventId;
    if (!id) return;
    const res = await fetch(`/api/reschedule-options/${encodeURIComponent(id)}?days=60`);
    const data = await res.json();
    if (res.ok) setRescheduleSlots(data.slots || []);
  }, [event?.id, eventId, token]);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => { if (event) loadReschedule(); }, [event, loadReschedule]);

  async function update(e: React.FormEvent) {
    e.preventDefault();
    if (!apiUrl) return;
    setStatus('Updating...');
    const res = await fetch(apiUrl, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setStatus(res.ok ? 'Updated.' : `Error: ${data.error}`);
  }

  async function cancel() {
    if (!apiUrl || !confirm('Cancel this lesson?')) return;
    setStatus('Cancelling...');
    const res = await fetch(apiUrl, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.studentEmail || emailParam }) });
    const data = await res.json();
    if (!res.ok) { setStatus(`Error: ${data.error}`); return; }
    router.push('/');
  }

  async function move() {
    if (!selectedSlot || !apiUrl) return;
    if (!confirm('Move this lesson to the selected slot?')) return;
    setStatus('Moving...');
    const res = await fetch(apiUrl, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isoStart: selectedSlot.start, isoEnd: selectedSlot.end }) });
    const data = await res.json();
    if (!res.ok) { setStatus(`Error: ${data.error}`); return; }
    setStatus('Moved successfully.');
    setSelectedSlot(null);
    await loadEvent();
    await loadReschedule();
  }

  const span = 7;
  const reschedDays: Slot[][] = Array.from({ length: span }, (_, i) => {
    const d = addDays(reschedWeekStart, i);
    const key = dayKeyForISO(d.toISOString(), tz);
    return rescheduleSlots.filter((s) => dayKeyForISO(s.start, tz) === key);
  });

  if (!apiUrl) return <main className="p-4"><p className="text-es-red">No event identifier provided.</p></main>;

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-baseline gap-4">
        <h1 className="text-2xl font-bold">Manage Booking</h1>
        <label className="text-sm">Timezone:{' '}
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="border rounded px-2 py-1 text-sm min-w-[200px]">
            {getTimeZones().map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
      </div>
      {status && <p className="text-sm text-gray-600">{status}</p>}

      {event && (
        <>
          <div className="border rounded p-3 bg-es-yellow-light text-sm">
            <strong>{event.summary}</strong><br />
            {(() => {
              const s = new Date(event.start.dateTime || event.start.date!);
              const e = new Date(event.end.dateTime || event.end.date!);
              return `${s.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz })} — ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}`;
            })()}
          </div>

          <form onSubmit={update} className="space-y-3">
            <label className="block text-sm">Name<br /><input value={form.studentName} onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" /></label>
            <label className="block text-sm">Email<br /><input type="email" value={form.studentEmail} onChange={(e) => setForm((f) => ({ ...f, studentEmail: e.target.value }))} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" /></label>
            <label className="block text-sm">Notes<br /><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" rows={3} /></label>
            <div className="flex gap-2">
              <button type="submit" className="bg-es-red text-white rounded px-4 py-2 text-sm hover:bg-es-red-dark">Update</button>
              <button type="button" onClick={cancel} className="border border-gray-400 rounded px-4 py-2 text-sm hover:bg-gray-100">Cancel Lesson</button>
            </div>
          </form>

          <section>
            <h2 className="text-lg font-semibold mb-2">Reschedule</h2>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setReschedWeekStart((s) => addDays(s, -7))} className="border rounded px-2 py-1 text-sm hover:bg-es-yellow-light">Prev</button>
              <span className="text-sm">{reschedWeekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })} — {addDays(reschedWeekStart, 6).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })}</span>
              <button onClick={() => setReschedWeekStart((s) => addDays(s, 7))} className="border rounded px-2 py-1 text-sm hover:bg-es-yellow-light">Next</button>
            </div>
            <div className="grid grid-cols-7 gap-px bg-es-yellow border border-es-yellow rounded overflow-hidden">
              {Array.from({ length: span }, (_, i) => {
                const d = addDays(reschedWeekStart, i);
                const daySlots = reschedDays[i];
                return (
                  <div key={i} className="bg-white text-xs">
                    <div className="bg-es-yellow-light px-1 py-0.5 border-b font-medium">
                      {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })}
                    </div>
                    <div className="p-1 space-y-0.5">
                      {daySlots.length === 0
                        ? <div className="text-gray-400 py-1">No slots</div>
                        : daySlots.map((s) => (
                          <button key={s.start} onClick={() => setSelectedSlot(s)}
                            className={`block w-full text-left rounded px-1 py-0.5 ${selectedSlot?.start === s.start ? 'bg-es-yellow font-semibold' : 'bg-es-yellow-light hover:bg-es-yellow'}`}>
                            {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={move} disabled={!selectedSlot} className="mt-3 bg-es-red text-white rounded px-4 py-2 text-sm hover:bg-es-red-dark disabled:opacity-40 disabled:cursor-not-allowed">
              Move to Selected Slot
            </button>
          </section>
        </>
      )}
    </main>
  );
}

export default function ManagePage() {
  return <Suspense><ManageContent /></Suspense>;
}
