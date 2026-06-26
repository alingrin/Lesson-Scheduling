'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getDefaultTZ, formatDateForTZ, startOfWeekInTZ, todayInTZ,
  addDays, dayKeyForISO, startOfMonthUTC, getTimeZones,
} from '@/components/tz-utils';
import { useRouter } from 'next/navigation';

interface Booking { id: string; summary: string; start: string; studentEmail: string | null }

type ViewMode = 'week' | 'month' | 'custom';
interface Slot { start: string; end: string }
interface TeacherSettings { workDayStart: number; workDayEnd: number; workDays: number[]; workTimezone: string }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getSavedTZ() { try { return localStorage.getItem('calendar_tz') || getDefaultTZ(); } catch { return getDefaultTZ(); } }
function getSavedView(): ViewMode { try { const v = localStorage.getItem('calendar_view'); return (['week', 'month', 'custom'].includes(v || '') ? v as ViewMode : 'week'); } catch { return 'week'; } }
function getSavedDays() { try { return localStorage.getItem('calendar_days') || '14'; } catch { return '14'; } }
function fmtHour(h: number) { return new Date(0, 0, 0, h).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); }

export default function TeacherPage() {
  const router = useRouter();
  const [tz, setTzState] = useState<string>(getDefaultTZ);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [customDays, setCustomDays] = useState(14);
  const [currentStart, setCurrentStart] = useState<Date>(() => todayInTZ(getDefaultTZ()));
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonthUTC(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [exposed, setExposed] = useState<Slot[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<TeacherSettings>({ workDayStart: 9, workDayEnd: 17, workDays: [1, 2, 3, 4, 5], workTimezone: 'UTC' });
  const [settingsStatus, setSettingsStatus] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingsStatus, setBookingsStatus] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState('');
  const [cancelStatus, setCancelStatus] = useState('');
  const initialized = useRef(false);

  const slotKey = (s: Slot) => `${s.start}|${s.end}`;

  const load = useCallback(async (mode: ViewMode, start: Date, month: Date, timezone: string, days: number) => {
    setStatus('Loading...');
    let queryStart: string;
    let queryDays: number;
    if (mode === 'month') { queryStart = formatDateForTZ(month, timezone); queryDays = 42; }
    else if (mode === 'week') { queryStart = formatDateForTZ(start, timezone); queryDays = 7; }
    else { queryStart = formatDateForTZ(start, timezone); queryDays = days; }

    const [availRes, exposedRes] = await Promise.all([
      fetch(`/api/availability?tz=${encodeURIComponent(timezone)}&start=${encodeURIComponent(queryStart)}&days=${queryDays}&teacher=true`),
      fetch('/api/exposed-slots'),
    ]);

    if (availRes.status === 403 || exposedRes.status === 403) { router.push('/teacher-login'); return; }
    if (!availRes.ok) {
      const d = await availRes.json().catch(() => ({}));
      setStatus(`Error loading availability: ${d.error || availRes.statusText}`);
      return;
    }

    const avail = await availRes.json();
    const exp = await exposedRes.json();
    const expSlots: Slot[] = exp.slots || [];
    setSlots(avail.slots || []);
    setExposed(expSlots);
    setChecked(new Set(expSlots.map(slotKey)));
    setStatus('');
  }, [router]);

  const loadBookings = useCallback(async () => {
    setBookingsStatus('Loading...');
    const res = await fetch('/api/teacher/bookings');
    if (res.status === 403) { router.push('/teacher-login'); return; }
    if (!res.ok) { setBookingsStatus('Error loading bookings'); return; }
    const data = await res.json();
    setBookings(data.bookings ?? []);
    setBookingsStatus('');
  }, [router]);

  async function cancelBooking(id: string) {
    setCancelStatus('Cancelling...');
    const res = await fetch(`/api/teacher/bookings/${id}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: cancelMsg }),
    });
    const d = await res.json();
    if (!res.ok) {
      setCancelStatus(`Error: ${d.error}`);
      return;
    }
    setCancellingId(null);
    setCancelMsg('');
    setCancelStatus('');
    if (d.emailError) setStatus(`Lesson cancelled. Note: ${d.emailError}`);
    loadBookings();
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const savedTZ = getSavedTZ();
    const savedView = getSavedView();
    const savedDays = parseInt(getSavedDays(), 10);
    setTzState(savedTZ);
    setViewMode(savedView);
    setCustomDays(savedDays);
    setCurrentStart(todayInTZ(savedTZ));
    setCurrentMonth(startOfMonthUTC(new Date()));
    fetch('/api/settings').then((r) => r.ok ? r.json() : null).then((d) => { if (d) setSettings(d); });
    loadBookings();
  }, [loadBookings]);

  useEffect(() => { load(viewMode, currentStart, currentMonth, tz, customDays); }, [load, viewMode, currentStart, currentMonth, tz, customDays]);

  function setTz(newTz: string) {
    localStorage.setItem('calendar_tz', newTz);
    setTzState(newTz);
    setCurrentStart(startOfWeekInTZ(currentStart, newTz));
  }

  function changeView(v: ViewMode) {
    localStorage.setItem('calendar_view', v);
    setViewMode(v);
    if (v !== 'month') setCurrentStart(startOfWeekInTZ(currentStart, tz));
    else setCurrentMonth(startOfMonthUTC(currentMonth));
  }

  function prev() {
    if (viewMode === 'month') setCurrentMonth((m) => { const p = new Date(m); p.setMonth(p.getMonth() - 1); return startOfMonthUTC(p); });
    else if (viewMode === 'custom') setCurrentStart((s) => addDays(s, -customDays));
    else setCurrentStart((s) => addDays(s, -7));
  }

  function next() {
    if (viewMode === 'month') setCurrentMonth((m) => { const n = new Date(m); n.setMonth(n.getMonth() + 1); return startOfMonthUTC(n); });
    else if (viewMode === 'custom') setCurrentStart((s) => addDays(s, customDays));
    else setCurrentStart((s) => addDays(s, 7));
  }

  function viewLabel() {
    if (viewMode === 'month') return currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: tz });
    const span = viewMode === 'custom' ? customDays - 1 : 6;
    const end = addDays(currentStart, span);
    return `${currentStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })}`;
  }

  function toggleSlot(slot: Slot) {
    setChecked((prev) => {
      const next = new Set(prev);
      const k = slotKey(slot);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  function toggleDay(dayKey: string, daySlots: Slot[]) {
    const allChecked = daySlots.every((s) => checked.has(slotKey(s)));
    setChecked((prev) => {
      const next = new Set(prev);
      daySlots.forEach((s) => allChecked ? next.delete(slotKey(s)) : next.add(slotKey(s)));
      return next;
    });
  }

  async function save() {
    setStatus('Saving...');
    const chosen = slots.filter((s) => checked.has(slotKey(s)));
    const res = await fetch('/api/exposed-slots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slots: chosen }),
    });
    if (!res.ok) { if (res.status === 403) { router.push('/teacher-login'); return; } const d = await res.json(); setStatus(`Error: ${d.error}`); return; }
    setStatus('Saved');
    setTimeout(() => setStatus(''), 3000);
  }

  async function logout() {
    await fetch('/api/teacher-logout', { method: 'POST' });
    router.push('/');
  }

  async function saveSettings() {
    setSettingsStatus('Saving...');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const d = await res.json();
      setSettingsStatus(`Error: ${d.error}`);
      return;
    }
    setSettingsStatus('Saved');
    setTimeout(() => setSettingsStatus(''), 3000);
    load(viewMode, currentStart, currentMonth, tz, customDays);
  }

  function toggleWorkDay(day: number) {
    setSettings((prev) => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter((d) => d !== day)
        : [...prev.workDays, day].sort((a, b) => a - b),
    }));
  }

  function renderDayCell(d: Date, isCustom = false) {
    const key = dayKeyForISO(d.toISOString(), tz);
    const daySlots = slots.filter((s) => dayKeyForISO(s.start, tz) === key);
    const allChecked = daySlots.length > 0 && daySlots.every((s) => checked.has(slotKey(s)));
    return (
      <div key={key} className={isCustom ? 'bg-white p-1 min-h-[80px]' : 'border rounded'}>
        <div className={isCustom ? 'text-xs font-medium text-gray-700 mb-1 flex items-center gap-1' : 'bg-es-yellow-light px-2 py-1 text-xs font-medium border-b flex items-center gap-1'}>
          <input type="checkbox" checked={allChecked} onChange={() => toggleDay(key, daySlots)} className="cursor-pointer" />
          {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz })}
        </div>
        <div className="p-1 space-y-0.5">
          {daySlots.length === 0
            ? <div className="text-xs text-gray-400 p-1">No slots</div>
            : daySlots.map((s) => {
              const isChecked = checked.has(slotKey(s));
              return (
                <label key={s.start} className={`flex items-center gap-1 text-xs rounded px-1 py-0.5 cursor-pointer ${isChecked ? 'bg-es-yellow' : 'hover:bg-es-yellow-light'}`}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleSlot(s)} className="cursor-pointer" />
                  {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}
                </label>
              );
            })}
        </div>
      </div>
    );
  }

  const span = 7;

  return (
    <main className="p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Teacher — Expose Time Slots</h1>
      <p className="text-sm text-gray-500 mb-3">Select which available slots should be visible to students.</p>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <label className="text-sm">Timezone:{' '}
          <select value={tz} onChange={(e) => setTz(e.target.value)} className="border rounded px-2 py-1 text-sm min-w-[200px]">
            {getTimeZones().map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </label>
        <label className="text-sm">View:{' '}
          <select value={viewMode} onChange={(e) => changeView(e.target.value as ViewMode)} className="border rounded px-2 py-1 text-sm">
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {viewMode === 'custom' && (
          <label className="text-sm">Days to show:{' '}
            <input type="number" min={1} max={90} value={customDays}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (v > 0) { setCustomDays(v); localStorage.setItem('calendar_days', String(v)); } }}
              className="border rounded px-2 py-1 text-sm w-20" />
          </label>
        )}
        <div className="flex items-center gap-2">
          <button onClick={prev} className="border rounded px-2 py-1 text-sm hover:bg-es-yellow-light">Prev</button>
          <span className="text-sm font-medium">{viewLabel()}</span>
          <button onClick={next} className="border rounded px-2 py-1 text-sm hover:bg-es-yellow-light">Next</button>
        </div>
        <button onClick={() => load(viewMode, currentStart, currentMonth, tz, customDays)} className="border rounded px-3 py-1 text-sm hover:bg-es-yellow-light">Refresh</button>
        <button onClick={() => setChecked(new Set(slots.map(slotKey)))} className="border rounded px-3 py-1 text-sm hover:bg-es-yellow-light">Select All</button>
        <button onClick={() => setChecked(new Set())} className="border rounded px-3 py-1 text-sm hover:bg-es-yellow-light">Clear</button>
        <button onClick={save} className="bg-es-red text-white rounded px-3 py-1 text-sm hover:bg-es-red-dark">Save Exposed Slots</button>
        <button onClick={logout} className="border border-gray-400 rounded px-3 py-1 text-sm hover:bg-es-yellow-light">Logout</button>
        <button onClick={() => setShowSettings((v) => !v)} className="border border-gray-400 rounded px-3 py-1 text-sm hover:bg-es-yellow-light">Settings ⚙</button>
        {status && <span className="text-sm text-gray-600">{status}</span>}
      </div>

      {showSettings && (
        <div className="mb-4 border rounded p-4 bg-gray-50 max-w-lg">
          <h2 className="font-semibold mb-3 text-sm">Work Schedule Settings</h2>
          <div className="mb-3">
            <div className="text-xs font-medium text-gray-600 mb-1">Work Days</div>
            <div className="flex gap-2 flex-wrap">
              {DAY_LABELS.map((label, i) => (
                <label key={i} className="flex items-center gap-1 text-sm cursor-pointer">
                  <input type="checkbox" checked={settings.workDays.includes(i)} onChange={() => toggleWorkDay(i)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mb-3 flex-wrap">
            <label className="text-sm">
              Start time{' '}
              <select value={settings.workDayStart} onChange={(e) => setSettings((s) => ({ ...s, workDayStart: +e.target.value }))} className="border rounded px-2 py-1 text-sm ml-1">
                {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </label>
            <label className="text-sm">
              End time{' '}
              <select value={settings.workDayEnd} onChange={(e) => setSettings((s) => ({ ...s, workDayEnd: +e.target.value }))} className="border rounded px-2 py-1 text-sm ml-1">
                {HOURS.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </label>
          </div>
          <div className="mb-3">
            <label className="text-sm">
              Work timezone{' '}
              <select value={settings.workTimezone} onChange={(e) => setSettings((s) => ({ ...s, workTimezone: e.target.value }))} className="border rounded px-2 py-1 text-sm ml-1 min-w-[200px]">
                {getTimeZones().map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={saveSettings} className="bg-es-red text-white rounded px-3 py-1 text-sm hover:bg-es-red-dark">Save Settings</button>
            {settingsStatus && <span className="text-sm text-gray-600">{settingsStatus}</span>}
          </div>
        </div>
      )}

      {viewMode === 'month' ? (
        <div className="grid grid-cols-7 gap-px bg-es-yellow border border-es-yellow rounded overflow-hidden">
          {(() => {
            const startWeekDay = currentMonth.getDay();
            const cells: React.ReactNode[] = [];
            let dayCursor = addDays(currentMonth, -startWeekDay);
            for (let i = 0; i < 42; i++) {
              cells.push(renderDayCell(new Date(dayCursor), true));
              dayCursor = addDays(dayCursor, 1);
            }
            return cells;
          })()}
        </div>
      ) : viewMode === 'custom' ? (
        <div className="grid grid-cols-7 gap-px bg-es-yellow border border-es-yellow rounded overflow-hidden">
          {(() => {
            const cells: React.ReactNode[] = [];
            for (let i = 0; i < customDays; i++) cells.push(renderDayCell(addDays(currentStart, i), true));
            const remainder = customDays % 7;
            if (remainder !== 0) for (let i = 0; i < 7 - remainder; i++) cells.push(<div key={`pad-${i}`} className="bg-white p-1 min-h-[80px]" />);
            return cells;
          })()}
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${span}, minmax(0, 1fr))` }}>
          {Array.from({ length: span }, (_, i) => renderDayCell(addDays(currentStart, i)))}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-bold">Upcoming Bookings</h2>
          <button onClick={loadBookings} className="border rounded px-2 py-0.5 text-sm hover:bg-es-yellow-light">Refresh</button>
          {bookingsStatus && <span className="text-sm text-gray-500">{bookingsStatus}</span>}
        </div>
        {bookings.length === 0 && !bookingsStatus && (
          <p className="text-sm text-gray-400">No upcoming bookings.</p>
        )}
        <div className="space-y-2">
          {bookings.map((b) => {
            const timeStr = new Date(b.start).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const studentName = b.summary.replace(/^Spanish Lesson\s*-\s*/i, '');
            return (
              <div key={b.id} className="border rounded p-3 bg-white max-w-xl">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium text-sm">{studentName}</div>
                    <div className="text-xs text-gray-500">{timeStr}{b.studentEmail ? ` · ${b.studentEmail}` : ''}</div>
                  </div>
                  {cancellingId !== b.id && (
                    <button onClick={() => { setCancellingId(b.id); setCancelMsg(''); setCancelStatus(''); }}
                      className="border border-red-400 text-red-600 rounded px-3 py-1 text-sm hover:bg-red-50">
                      Cancel lesson
                    </button>
                  )}
                </div>
                {cancellingId === b.id && (
                  <div className="mt-3 border-t pt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Message to student (optional)</label>
                    <textarea
                      value={cancelMsg}
                      onChange={(e) => setCancelMsg(e.target.value)}
                      rows={3}
                      placeholder="e.g. I'm sorry, I have an unexpected conflict. Please rebook at your convenience."
                      className="w-full border rounded px-2 py-1 text-sm resize-none"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => cancelBooking(b.id)} className="bg-es-red text-white rounded px-3 py-1 text-sm hover:bg-es-red-dark">
                        Confirm cancellation
                      </button>
                      <button onClick={() => { setCancellingId(null); setCancelStatus(''); }} className="border rounded px-3 py-1 text-sm hover:bg-es-yellow-light">
                        Never mind
                      </button>
                      {cancelStatus && <span className="text-sm text-gray-500">{cancelStatus}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-4 text-sm"><a href="/" className="text-es-red underline">Back to student view</a></p>
    </main>
  );
}
