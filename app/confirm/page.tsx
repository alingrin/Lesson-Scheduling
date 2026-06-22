'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const isoStart = searchParams.get('isoStart') || '';
  const isoEnd = searchParams.get('isoEnd') || '';
  const tz = searchParams.get('tz') || 'UTC';
  const router = useRouter();

  const [form, setForm] = useState({ studentName: '', studentEmail: '', notes: '', lessonType: 'inperson' });
  const [status, setStatus] = useState('');

  const start = isoStart ? new Date(isoStart) : null;
  const end = isoEnd ? new Date(isoEnd) : null;

  async function book(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Booking...');
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, isoStart, isoEnd, tz }),
    });
    const data = await res.json();
    if (!res.ok) { setStatus(`Error: ${data.error}`); return; }
    if (data.manageToken) {
      router.push(`/manage?token=${encodeURIComponent(data.manageToken)}`);
    } else {
      setStatus('Booked!');
    }
  }

  if (!start || !end) return <main className="p-4"><p className="text-es-red">Invalid booking link.</p></main>;

  return (
    <main className="p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Confirm Booking</h1>
      <div className="border rounded p-3 bg-es-yellow-light text-sm">
        {start.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz })} — {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
      </div>
      <form onSubmit={book} className="space-y-3">
        <label className="block text-sm">Full Name<br /><input required value={form.studentName} onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" /></label>
        <label className="block text-sm">Email<br /><input type="email" required value={form.studentEmail} onChange={(e) => setForm((f) => ({ ...f, studentEmail: e.target.value }))} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" /></label>
        <label className="block text-sm">Goals / Level<br /><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" rows={3} /></label>
        <div className="block text-sm">
          Lesson type
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="lessonType" value="inperson" checked={form.lessonType === 'inperson'} onChange={() => setForm((f) => ({ ...f, lessonType: 'inperson' }))} className="cursor-pointer" />
              In-person
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="lessonType" value="meet" checked={form.lessonType === 'meet'} onChange={() => setForm((f) => ({ ...f, lessonType: 'meet' }))} className="cursor-pointer" />
              Google Meet
            </label>
          </div>
        </div>
        <button type="submit" className="w-full bg-es-red text-white rounded px-4 py-2 text-sm hover:bg-es-red-dark">Book Lesson</button>
        {status && <p className="text-sm text-center text-gray-600">{status}</p>}
      </form>
    </main>
  );
}

export default function ConfirmPage() {
  return <Suspense><ConfirmContent /></Suspense>;
}
