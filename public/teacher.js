// Teacher admin UI script: supports timezone and view modes (month/week/3day)
function getDefaultTZ() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'UTC'; } }
function getSavedTZ() { return localStorage.getItem('calendar_tz') || getDefaultTZ(); }
function setSavedTZ(v) { localStorage.setItem('calendar_tz', v); }
let tz = getSavedTZ();

function getSavedView() { return localStorage.getItem('calendar_view') || 'week'; }
function setSavedView(v) { localStorage.setItem('calendar_view', v); }
let viewMode = getSavedView();
let currentMonth = startOfMonthUTC(new Date());
let currentStart = startOfWeekInTZ(new Date(), tz);

const daysInput = document.getElementById('days');
const refreshBtn = document.getElementById('refresh');
const saveBtn = document.getElementById('save');
const selectAllBtn = document.getElementById('select-all-displayed');
const clearBtn = document.getElementById('clear-selection');
const logoutBtn = document.getElementById('logout');
const slotsList = document.getElementById('slots-list');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const TEACHER_TOKEN = params.get('token') || '';

const tzDisplay = document.getElementById('tz');
if (tzDisplay) tzDisplay.textContent = `Timezone: ${tz}`;
const tzSelect = document.getElementById('tz-select');
if (tzSelect) {
  function getTimeZones() { if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone'); return ['UTC','Europe/London','Europe/Madrid','America/New_York','America/Los_Angeles','America/Chicago','America/Denver','Asia/Shanghai','Asia/Tokyo','Australia/Sydney']; }
  const zones = getTimeZones();
  zones.forEach(z => { const o=document.createElement('option'); o.value = z; o.textContent = z; tzSelect.appendChild(o); });
  tzSelect.value = tz;
  tzSelect.addEventListener('change', (e) => {
    tz = e.target.value;
    setSavedTZ(tz);
    if (tzDisplay) tzDisplay.textContent = `Timezone: ${tz}`;
    currentStart = startOfWeekInTZ(currentStart || new Date(), tz);
    load();
  });
}

const viewSelect = document.getElementById('view-select');
const prevViewBtn = document.getElementById('prev-view');
const nextViewBtn = document.getElementById('next-view');
const viewLabel = document.getElementById('view-label');
if (viewSelect) { viewSelect.value = viewMode; viewSelect.addEventListener('change', (e) => { viewMode = e.target.value; setSavedView(viewMode); if (viewMode === 'week' || viewMode === '3day') currentStart = startOfWeekInTZ(currentStart || new Date(), tz); if (viewMode === 'month') currentMonth = startOfMonthUTC(currentMonth || new Date()); updateViewLabel(); load(); }); }

function formatDateForTZ(date, timeZone) { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
function startOfWeekInTZ(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  const weekday = parts.find(p => p.type === 'weekday').value;
  const dt = new Date(`${year}-${month}-${day}T12:00:00Z`);
  const dayIndex = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(weekday);
  dt.setUTCDate(dt.getUTCDate() - dayIndex);
  return dt;
}
function fmtDate(d) { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }); }
function getViewStartDate() {
  if (viewMode === 'month') return currentMonth;
  currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
  return currentStart;
}
function updateViewLabel() {
  if (!viewLabel) return;
  if (viewMode === 'month') {
    viewLabel.textContent = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: tz });
  } else if (viewMode === 'week') {
    const start = currentStart || startOfWeekInTZ(new Date(), tz);
    const end = addDays(start, 6);
    viewLabel.textContent = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })}`;
  } else {
    const start = currentStart || startOfWeekInTZ(new Date(), tz);
    const end = addDays(start, 2);
    viewLabel.textContent = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })}`;
  }
}
if (prevViewBtn) {
  prevViewBtn.addEventListener('click', () => {
    if (viewMode === 'month') {
      const prev = new Date(currentMonth);
      prev.setMonth(prev.getMonth() - 1);
      currentMonth = startOfMonth(prev);
    } else if (viewMode === 'week') {
      currentStart = addDays(currentStart, -7);
    } else if (viewMode === '3day') {
      currentStart = addDays(currentStart, -3);
    }
    updateViewLabel();
    load();
  });
}
if (nextViewBtn) {
  nextViewBtn.addEventListener('click', () => {
    if (viewMode === 'month') {
      const next = new Date(currentMonth);
      next.setMonth(next.getMonth() + 1);
      currentMonth = startOfMonth(next);
    } else if (viewMode === 'week') {
      currentStart = addDays(currentStart, 7);
    } else if (viewMode === '3day') {
      currentStart = addDays(currentStart, 3);
    }
    updateViewLabel();
    load();
  });
}
updateViewLabel();
function makeDayKey(d) { const y = d.getFullYear(); const m = (`0${d.getMonth()+1}`).slice(-2); const day = (`0${d.getDate()}`).slice(-2); return `${y}-${m}-${day}`; }
function dayKeyForISO(iso) { return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }); }
function addDays(d,n){ const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
function startOfWeekUTC(d){ const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12)); const day = date.getUTCDay(); date.setUTCDate(date.getUTCDate() - day); return date; }
function startOfMonth(d){ return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)); }
function startOfMonthUTC(d){ return startOfMonth(d); }

function renderSlots(slots, exposed) {
  slotsList.innerHTML = '';
  if (viewMode === 'month') {
    slotsList.className = 'calendar-grid calendar-month';
    const first = currentMonth; const startWeekDay = first.getDay();
    let dayCursor = addDays(first, -startWeekDay);
    for (let r=0;r<6;r++) {
      const weekRow = document.createElement('div'); weekRow.className='week-row';
      for (let c=0;c<7;c++) {
        const cell = document.createElement('div'); cell.className='month-cell';
        const key = dayKeyForISO(dayCursor.toISOString());
        const hdr = document.createElement('div'); hdr.className='cell-day'; hdr.textContent = dayCursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz }); cell.appendChild(hdr);
        const daySlots = slots.filter(s => dayKeyForISO(s.start) === key);
        daySlots.forEach(s => {
          const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.start = s.start; cb.dataset.end = s.end; cb.dataset.day = key; if (exposed.some(e => e.start===s.start && e.end===s.end)) cb.checked=true;
          const lbl = document.createElement('label'); lbl.style.display='block'; lbl.appendChild(cb);
          const t = document.createElement('span'); const ss=new Date(s.start); t.textContent = ` ${ss.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', timeZone: tz})}`; lbl.appendChild(t);
          cell.appendChild(lbl);
        });
        weekRow.appendChild(cell);
        dayCursor = addDays(dayCursor,1);
      }
      slotsList.appendChild(weekRow);
    }
  } else {
    slotsList.className = 'calendar-grid';
    const span = viewMode === '3day' ? 3 : 7;
    const start = getViewStartDate();
    for (let i=0;i<span;i++) {
      const d = addDays(start,i);
      const key = dayKeyForISO(d.toISOString());
      const dayDiv = document.createElement('div'); dayDiv.className='day-column';
      const header = document.createElement('div'); header.className='day-header';
      const hdrChk = document.createElement('input'); hdrChk.type='checkbox'; hdrChk.style.marginRight='8px'; hdrChk.dataset.day = key;
      const hdrText = document.createElement('span'); hdrText.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
      header.appendChild(hdrChk); header.appendChild(hdrText); dayDiv.appendChild(header);

      const list = document.createElement('div'); list.className='day-slots';
const daySlots = slots.filter(s => dayKeyForISO(s.start) === key);
        if (daySlots.length === 0) {
          const empty = document.createElement('div'); empty.className = 'slot-mini'; empty.textContent = 'No slots'; empty.style.opacity = '0.55'; list.appendChild(empty);
        } else {
          daySlots.forEach((s) => {
            const start = new Date(s.start); const end = new Date(s.end);
            const row = document.createElement('label'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px';
            const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.start = s.start; cb.dataset.end = s.end; cb.dataset.day = key; if (exposed.some((e) => e.start === s.start && e.end === s.end)) cb.checked = true;
            const txt = document.createElement('span'); txt.textContent = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })} — ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}`;
            row.appendChild(cb); row.appendChild(txt); list.appendChild(row);
          });
        }
      dayDiv.appendChild(list); slotsList.appendChild(dayDiv);
    }
  }
}

async function load() {
  statusEl.textContent = 'Loading...';
  try {
    const days = parseInt(daysInput.value || '14', 10);
    let queryStart = formatDateForTZ(new Date(), tz);
    let queryDays = days;
    if (viewMode === 'month') {
      queryStart = formatDateForTZ(currentMonth, tz);
      queryDays = 42;
    } else if (viewMode === 'week') {
      currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
      queryStart = formatDateForTZ(currentStart, tz);
      queryDays = 7;
    } else if (viewMode === '3day') {
      currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
      queryStart = formatDateForTZ(currentStart, tz);
      queryDays = 3;
    }
    const availUrl = `/api/availability?tz=${encodeURIComponent(tz)}&start=${encodeURIComponent(queryStart)}&days=${queryDays}&teacher=true`;
    const exposedUrl = `/api/exposed-slots`;
    const headers = {};
    if (TEACHER_TOKEN) headers.authorization = `Bearer ${TEACHER_TOKEN}`;
    const [availRes, exposedRes] = await Promise.all([
      fetch(availUrl, { credentials: 'same-origin', headers }),
      fetch(exposedUrl, { credentials: 'same-origin', headers }),
    ]);
    if (availRes.status === 403 || exposedRes.status === 403) {
      // not authenticated — send teacher to login
      window.location.href = '/teacher-login';
      return;
    }
    const avail = await availRes.json();
    const exposed = await exposedRes.json();
    renderSlots(avail.slots || [], exposed.slots || []);
    statusEl.textContent = '';
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }
}

refreshBtn.addEventListener('click', (e) => { e.preventDefault(); load(); });
saveBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const boxes = Array.from(document.querySelectorAll('#slots-list input[type=checkbox]'));
  const chosen = boxes
    .filter((b) => b.checked && b.dataset.start && b.dataset.end)
    .map((b) => ({ start: b.dataset.start, end: b.dataset.end }));
  statusEl.textContent = 'Saving...';
  try {
    const headers = { 'content-type': 'application/json' };
    if (TEACHER_TOKEN) headers.authorization = `Bearer ${TEACHER_TOKEN}`;
    const res = await fetch('/api/exposed-slots', { method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ slots: chosen }) });
    const body = await res.json();
    if (!res.ok) {
      if (res.status === 403) return window.location.href = '/teacher-login';
      statusEl.textContent = `Error: ${body.error || res.statusText}`;
    }
    else statusEl.textContent = 'Saved';
  } catch (err) {
    statusEl.textContent = `Network error: ${err.message}`;
  }
  setTimeout(() => { statusEl.textContent = ''; }, 3000);
});

selectAllBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const boxes = Array.from(document.querySelectorAll('#slots-list input[type=checkbox]'));
  boxes.forEach(b => b.checked = true);
});

clearBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const boxes = Array.from(document.querySelectorAll('#slots-list input[type=checkbox]'));
  boxes.forEach(b => b.checked = false);
});

logoutBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await fetch('/teacher-logout');
  } catch (err) {
    // ignore
  }
  // remove token from URL immediately
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  window.location.href = '/';
});

// delegate per-day header checkbox behaviour
slotsList.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t && t.type === 'checkbox' && t.dataset.day && t.dataset.start === undefined) {
    // this is a header checkbox
    const day = t.dataset.day;
    const boxes = Array.from(document.querySelectorAll(`#slots-list input[type=checkbox][data-day="${day}"]`));
    boxes.forEach(b => b.checked = t.checked);
  }
});

updateViewLabel();
load();
