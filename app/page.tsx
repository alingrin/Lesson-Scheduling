'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getDefaultTZ, formatDateForTZ, startOfWeekInTZ, todayInTZ,
  addDays, dayKeyForISO, startOfMonthUTC, getTimeZones,
} from '@/components/tz-utils';

type ViewMode = 'week' | 'month';
interface Slot { start: string; end: string }

function getSavedTZ() { try { return localStorage.getItem('calendar_tz') || getDefaultTZ(); } catch { return getDefaultTZ(); } }
function getSavedView(): ViewMode { try { const v = localStorage.getItem('calendar_view'); return (v === 'month' ? 'month' : 'week'); } catch { return 'week'; } }

export default function StudentPage() {
  const [tz, setTzState] = useState<string>(getDefaultTZ);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentStart, setCurrentStart] = useState<Date>(() => todayInTZ(getDefaultTZ()));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonthUTC(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [modal, setModal] = useState<{ slot: Slot } | null>(null);
  const [bookingStatus, setBookingStatus] = useState('');
  const [manageLink, setManageLink] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const savedTZ = getSavedTZ();
    const savedView = getSavedView();
    setTzState(savedTZ);
    setViewMode(savedView);
    setCurrentStart(todayInTZ(savedTZ));
    setCurrentMonth(startOfMonthUTC(new Date()));
  }, []);

  const load = useCallback(async (mode: ViewMode, start: Date, month: Date, timezone: string) => {
    let queryStart: string;
    let queryDays: number;
    if (mode === 'month') {
      queryStart = formatDateForTZ(month, timezone);
      queryDays = 42;
    } else {
      queryStart = formatDateForTZ(start, timezone);
      queryDays = 7;
    }
    const res = await fetch(`/api/availability?tz=${encodeURIComponent(timezone)}&start=${encodeURIComponent(queryStart)}&days=${queryDays}`);
    const data = await res.json();
    setSlots(data.slots || []);
  }, []);

  useEffect(() => { load(viewMode, currentStart, currentMonth, tz); }, [load, viewMode, currentStart, currentMonth, tz]);

  function setTz(newTz: string) {
    localStorage.setItem('calendar_tz', newTz);
    setTzState(newTz);
    setCurrentStart(startOfWeekInTZ(currentStart, newTz));
  }

  function changeView(v: ViewMode) {
    localStorage.setItem('calendar_view', v);
    setViewMode(v);
    if (v !== 'month') setCurrentStart(startOfWeekInTZ(currentStart, tz));
  }

  function prev() {
    if (viewMode === 'month') setCurrentMonth((m) => { const p = new Date(m); p.setMonth(p.getMonth() - 1); return startOfMonthUTC(p); });
    else setCurrentStart((s) => addDays(s, -7));
  }

  function next() {
    if (viewMode === 'month') setCurrentMonth((m) => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return startOfMonthUTC(n); });
    else setCurrentStart((s) => addDays(s, 7));
  }

  function viewLabel() {
    if (viewMode === 'month') return currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: tz });
    const end = addDays(currentStart, 6);
    return `${currentStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })}`;
  }

  async function book(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    setBookingStatus('Booking...');
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const res = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { setBookingStatus(`Error: ${data.error}`); return; }
    setBookingStatus('Booked!');
    if (data.manageToken) setManageLink(`/manage?token=${encodeURIComponent(data.manageToken)}`);
    load(viewMode, currentStart, currentMonth, tz);
    setTimeout(() => setModal(null), 800);
  }

  const span = 7;

  return (
    <main className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Miki&apos;s Spanish Lessons</h1>
      <p className="text-sm text-gray-500 mb-3">Timezone: {tz}</p>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <label className="text-sm">
          Timezone:{' '}
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="border rounded px-2 py-1 text-sm min-w-[200px]">
            {getTimeZones().map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className="text-sm">
          View:{' '}
          <select value={viewMode} onChange={(e) => changeView(e.target.value as ViewMode)} className="border rounded px-2 py-1 text-sm">
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="border rounded px-2 py-1 text-sm hover:bg-es-yellow-light">Prev</button>
          <span className="text-sm font-medium">{viewLabel()}</span>
          <button onClick={next} className="border rounded px-2 py-1 text-sm hover:bg-es-yellow-light">Next</button>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Available Slots</h2>
        <p className="text-sm text-gray-500 mb-3">Click a slot to continue to booking.</p>
        {viewMode === 'month' ? (
          <div className="grid grid-cols-7 gap-px bg-es-yellow border border-es-yellow rounded">
            {(() => {
              const startWeekDay = currentMonth.getDay();
              const cells: React.ReactNode[] = [];
              let dayCursor = addDays(currentMonth, -startWeekDay);
              for (let i = 0; i < 42; i++) {
                const key = dayKeyForISO(dayCursor.toISOString(), tz);
                const daySlots = slots.filter((s) => dayKeyForISO(s.start, tz) === key);
                const d = new Date(dayCursor);
                cells.push(
                  <div key={key} className="bg-white p-1 min-h-[80px]">
                    <div className="text-xs text-gray-500 mb-1">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: tz })}</div>
                    {daySlots.map((s) => (
                      <button key={s.start} onClick={() => setModal({ slot: s })} className="block w-full text-left text-xs bg-es-yellow-light hover:bg-es-yellow text-gray-800 rounded px-1 py-0.5 mb-0.5 truncate">
                        {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
                      </button>
                    ))}
                  </div>
                );
                dayCursor = addDays(dayCursor, 1);
              }
              return cells;
            })()}
          </div>
        ) : (
          <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
            {Array.from({ length: span }, (_, i) => {
              const d = addDays(currentStart, i);
              const key = dayKeyForISO(d.toISOString(), tz);
              const daySlots = slots.filter((s) => dayKeyForISO(s.start, tz) === key);
              return (
                <div key={key} className="border rounded">
                  <div className="bg-es-yellow-light px-2 py-1 text-sm font-medium border-b">
                    {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })}
                  </div>
                  <div className="p-1 space-y-1">
                    {daySlots.length === 0
                      ? <div className="text-xs text-gray-400 p-1">No slots</div>
                      : daySlots.map((s) => (
                        <button key={s.start} onClick={() => setModal({ slot: s })} className="block w-full text-left text-xs bg-es-yellow-light hover:bg-es-yellow text-gray-800 rounded px-2 py-1">
                          {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })} — {new Date(s.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {manageLink && <p className="mt-4 text-sm"><a href={manageLink} className="text-es-red underline">Manage your booking</a></p>}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setModal(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700">✕</button>
            <h2 className="text-lg font-semibold mb-1">Confirm Booking</h2>
            <p className="text-sm text-gray-600 mb-4">
              {new Date(modal.slot.start).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: tz })} — {new Date(modal.slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
            </p>
            <form onSubmit={book} className="space-y-3">
              <input type="hidden" name="isoStart" value={modal.slot.start} />
              <input type="hidden" name="isoEnd" value={modal.slot.end} />
              <input type="hidden" name="tz" value={tz} />
              <label className="block text-sm">Full Name<br /><input name="studentName" required className="mt-1 w-full border rounded px-3 py-1.5 text-sm" /></label>
              <label className="block text-sm">Email<br /><input name="studentEmail" type="email" required className="mt-1 w-full border rounded px-3 py-1.5 text-sm" /></label>
              <label className="block text-sm">Goals / Level<br /><textarea name="notes" className="mt-1 w-full border rounded px-3 py-1.5 text-sm" rows={3} /></label>
              <button type="submit" className="w-full bg-es-red text-white rounded px-4 py-2 text-sm hover:bg-es-red-dark">Book Lesson</button>
              {bookingStatus && <p className="text-sm text-center text-gray-600">{bookingStatus}</p>}
            </form>
          </div>
        </div>
      )}

      <div className="fixed bottom-3 right-3">
        <a href="/teacher-login" className="text-xs border border-es-red text-es-red px-3 py-1.5 rounded bg-white hover:bg-es-red-light">Teacher login</a>
      </div>
    </main>
  );
}
