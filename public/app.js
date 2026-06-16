// Student calendar script with timezone and view modes
function getDefaultTZ() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'UTC'; } }
function getSavedTZ() { return localStorage.getItem('calendar_tz') || getDefaultTZ(); }
function setSavedTZ(v) { localStorage.setItem('calendar_tz', v); }
let tz = getSavedTZ();
const tzDisplay = document.getElementById('tz'); if (tzDisplay) tzDisplay.textContent = `Timezone: ${tz}`;

function getSavedView() { return localStorage.getItem('calendar_view') || 'week'; }
function setSavedView(v) { localStorage.setItem('calendar_view', v); }
let viewMode = getSavedView();
let currentMonth = startOfMonthUTC(new Date());
let currentStart = startOfWeekInTZ(new Date(), tz);
const viewSelect = document.getElementById('view-select'); if (viewSelect) { viewSelect.value = viewMode; viewSelect.addEventListener('change', (e) => { viewMode = e.target.value; setSavedView(viewMode); if (viewMode === 'month') { currentMonth = startOfMonthUTC(new Date()); } else { currentStart = currentStart || startOfWeekInTZ(new Date(), tz); } updateViewLabel(); loadSlots(); }); }
const prevViewBtn = document.getElementById('prev-view');
const nextViewBtn = document.getElementById('next-view');
const viewLabel = document.getElementById('view-label');

const tzSelect = document.getElementById('tz-select');
if (tzSelect) {
  function getTimeZones() { if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone'); return ['UTC','Europe/London','Europe/Madrid','America/New_York','America/Los_Angeles','America/Chicago','America/Denver','Asia/Shanghai','Asia/Tokyo','Australia/Sydney']; }
  const zones = getTimeZones(); zones.forEach(z => { const o = document.createElement('option'); o.value = z; o.textContent = z; tzSelect.appendChild(o); });
  tzSelect.value = tz; tzSelect.addEventListener('change', (e) => { tz = e.target.value; setSavedTZ(tz); if (document.getElementById('tz')) document.getElementById('tz').textContent = `Timezone: ${tz}`; loadSlots(); });
}

const calendarEl = document.getElementById('calendar');

function makeDayKey(d) { const y = d.getFullYear(); const m = (`0${d.getMonth()+1}`).slice(-2); const day = (`0${d.getDate()}`).slice(-2); return `${y}-${m}-${day}`; }
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
function dayKeyForISO(iso) { return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }); }
function addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }
function startOfMonth(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)); }
function startOfMonthUTC(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)); }
function fmtDate(d) { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }); }

async function loadSlots() {
  let queryStart = formatDateForTZ(new Date(), tz);
  let queryDays = 60;
  if (viewMode === 'month') {
    queryStart = formatDateForTZ(currentMonth, tz);
    queryDays = 42;
  } else if (viewMode === '3day') {
    currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
    queryStart = formatDateForTZ(currentStart, tz);
    queryDays = 3;
  } else {
    currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
    queryStart = formatDateForTZ(currentStart, tz);
    queryDays = 7;
  }
  const res = await fetch(`/api/availability?tz=${encodeURIComponent(tz)}&start=${encodeURIComponent(queryStart)}&days=${queryDays}`);
  const data = await res.json();
  renderSlots(data.slots || []);
}

function renderSlots(slots) {
  calendarEl.innerHTML = '';
  if (viewMode === 'month') {
    calendarEl.className = 'calendar-grid calendar-month';
    const first = currentMonth;
    const startWeekDay = first.getDay(); let dayCursor = addDays(first, -startWeekDay);
    for (let r=0;r<6;r++) {
      const row = document.createElement('div'); row.className='week-row';
      for (let c=0;c<7;c++) {
        const cell = document.createElement('div'); cell.className='month-cell'; const key = dayKeyForISO(dayCursor.toISOString());
        const header = document.createElement('div'); header.className='cell-day'; header.textContent = dayCursor.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: tz }); cell.appendChild(header);
        const daySlots = slots.filter(s => dayKeyForISO(s.start) === key);
        daySlots.forEach(s => {
          const b = document.createElement('button');
          b.className='slot-mini';
          const ss = new Date(s.start);
          b.textContent = ss.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', timeZone: tz});
          b.addEventListener('click', () => { window.location.href = `/confirm.html?isoStart=${encodeURIComponent(s.start)}&isoEnd=${encodeURIComponent(s.end)}&tz=${encodeURIComponent(tz)}`; });
          cell.appendChild(b);
        });
        row.appendChild(cell); dayCursor = addDays(dayCursor,1);
      }
      calendarEl.appendChild(row);
    }
  } else {
    calendarEl.className = 'calendar-grid';
    const span = viewMode === '3day' ? 3 : 7;
    currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
    const start = currentStart;
    for (let i=0;i<span;i++) {
      const d = addDays(start,i);
      const key = dayKeyForISO(d.toISOString());
      const dayCol = document.createElement('div'); dayCol.className='day-column';
      const header = document.createElement('div'); header.className='day-header';
      header.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
      dayCol.appendChild(header);
      const list = document.createElement('div'); list.className='day-slots';
      slots.filter(s => dayKeyForISO(s.start) === key).forEach(s => {
        const startTime = new Date(s.start); const end = new Date(s.end);
        const btn = document.createElement('button'); btn.className='slot-card';
        btn.textContent = `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })} — ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: tz })}`;
        btn.addEventListener('click', () => { window.location.href = `/confirm.html?isoStart=${encodeURIComponent(s.start)}&isoEnd=${encodeURIComponent(s.end)}&tz=${encodeURIComponent(tz)}`; });
        list.appendChild(btn);
      });
      dayCol.appendChild(list); calendarEl.appendChild(dayCol);
    }
  }
}

function updateViewLabel() {
  if (!viewLabel) return;
  if (viewMode === 'month') {
    viewLabel.textContent = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: tz });
  } else {
    currentStart = currentStart || startOfWeekInTZ(new Date(), tz);
    const end = addDays(currentStart, viewMode === '3day' ? 2 : 6);
    viewLabel.textContent = `${currentStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })} — ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: tz })}`;
  }
}

if (prevViewBtn) {
  prevViewBtn.addEventListener('click', () => {
    if (viewMode === 'month') {
      currentMonth = startOfMonth(addDays(currentMonth, -1));
      currentMonth.setDate(1);
    } else if (viewMode === 'week') {
      currentStart = addDays(currentStart || startOfWeekInTZ(new Date(), tz), -7);
    } else if (viewMode === '3day') {
      currentStart = addDays(currentStart || startOfWeekInTZ(new Date(), tz), -3);
    }
    updateViewLabel();
    loadSlots();
  });
}
if (nextViewBtn) {
  nextViewBtn.addEventListener('click', () => {
    if (viewMode === 'month') {
      const next = new Date(currentMonth);
      next.setMonth(next.getMonth() + 1);
      currentMonth = startOfMonth(next);
    } else if (viewMode === 'week') {
      currentStart = addDays(currentStart || startOfWeekInTZ(new Date(), tz), 7);
    } else if (viewMode === '3day') {
      currentStart = addDays(currentStart || startOfWeekInTZ(new Date(), tz), 3);
    }
    updateViewLabel();
    loadSlots();
  });
}
updateViewLabel();
loadSlots();

// Modal behaviour: submit booking from modal
const modal = document.getElementById('modal');
if (modal) {
  document.getElementById('modal-close').addEventListener('click', () => { modal.hidden = true; });
  document.getElementById('modal-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const status = document.getElementById('modal-status');
    status.textContent = 'Booking...';
    const payload = Object.fromEntries(new FormData(ev.target).entries());
    try {
      const res = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const text = await res.text();
      if (!res.ok) {
        let body = text; try { body = JSON.parse(text); } catch (e) {}
        status.textContent = `Error: ${body.error || res.statusText}`;
        return;
      }
      const data = JSON.parse(text);
      status.textContent = 'Booked!';
      if (data.manageToken) {
        const a = document.createElement('a');
        a.href = `/manage.html?token=${encodeURIComponent(data.manageToken)}`;
        a.textContent = 'Manage booking';
        const container = document.getElementById('booking-links');
        if (container) {
          container.innerHTML = '';
          container.appendChild(a);
        } else {
          status.appendChild(document.createElement('br'));
          status.appendChild(a);
        }
      } else if (data.event && data.event.id) {
        const a = document.createElement('a');
        a.href = `/manage.html?eventId=${encodeURIComponent(data.event.id)}&email=${encodeURIComponent(payload.studentEmail)}`;
        a.textContent = 'Manage booking';
        const container = document.getElementById('booking-links');
        if (container) {
          container.innerHTML = '';
          container.appendChild(a);
        } else {
          status.appendChild(document.createElement('br'));
          status.appendChild(a);
        }
      }
      // reload slots after booking
      await loadSlots();
      // hide modal after a short delay unless a manage link was added
      setTimeout(() => {
        const statusEl = document.getElementById('modal-status');
        if (!statusEl.querySelector('a')) modal.hidden = true;
      }, 800);
    } catch (err) {
      status.textContent = `Network error: ${err.message}`;
    }
  });
}
