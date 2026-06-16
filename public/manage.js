const params = new URLSearchParams(window.location.search);
let eventId = params.get('eventId');
const token = params.get('token');
const emailParam = params.get('email');
const info = document.getElementById('info');
const status = document.getElementById('status');
const form = document.getElementById('update-form');

async function loadEvent() {
  try {
    let res, data;
    if (token) {
      res = await fetch(`/api/manage/${encodeURIComponent(token)}`);
      data = await res.json();
      if (!res.ok) {
        status.textContent = `Error loading event: ${data.error || res.statusText}`;
        return;
      }
      const ev = data.event;
      eventId = ev.id;
      const start = new Date(ev.start?.dateTime || ev.start?.date);
      const end = new Date(ev.end?.dateTime || ev.end?.date);
      info.innerHTML = `<strong>${ev.summary}</strong><br>${start.toLocaleString()} — ${end.toLocaleTimeString()}`;
      form.studentName.value = ev.summary?.replace(/^Spanish Lesson - /, '') || '';
      form.studentEmail.value = (ev.attendees && ev.attendees[0] && ev.attendees[0].email) || emailParam || '';
      form.notes.value = ev.description?.replace(/^Goals: ?/, '') || '';
      return;
    }
    if (!eventId) {
      info.textContent = 'No eventId provided.';
      return;
    }
    res = await fetch(`/api/event/${encodeURIComponent(eventId)}`);
    data = await res.json();
    if (!res.ok) {
      status.textContent = `Error loading event: ${data.error || res.statusText}`;
      return;
    }
    const ev = data.event;
    const start = new Date(ev.start?.dateTime || ev.start?.date);
    const end = new Date(ev.end?.dateTime || ev.end?.date);
    info.innerHTML = `<strong>${ev.summary}</strong><br>${start.toLocaleString()} — ${end.toLocaleTimeString()}`;
    form.studentName.value = ev.summary?.replace(/^Spanish Lesson - /, '') || '';
    form.studentEmail.value = (ev.attendees && ev.attendees[0] && ev.attendees[0].email) || emailParam || '';
    form.notes.value = ev.description?.replace(/^Goals: ?/, '') || '';
  } catch (err) {
    status.textContent = `Network error: ${err.message}`;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!eventId) return;
  status.textContent = 'Updating...';
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const url = token ? `/api/manage/${encodeURIComponent(token)}` : `/api/event/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) status.textContent = `Error: ${data.error || res.statusText}`;
    else status.textContent = 'Updated.';
  } catch (err) {
    status.textContent = `Network error: ${err.message}`;
  }
});

document.getElementById('cancel').addEventListener('click', async () => {
  if (!eventId) return;
  if (!confirm('Are you sure you want to cancel this lesson?')) return;
  status.textContent = 'Cancelling...';
  try {
    const url = token ? `/api/manage/${encodeURIComponent(token)}` : `/api/event/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: form.studentEmail.value || emailParam }) });
    const data = await res.json();
    if (!res.ok) status.textContent = `Error: ${data.error || res.statusText}`;
    else status.textContent = 'Cancelled.';
  } catch (err) {
    status.textContent = `Network error: ${err.message}`;
  }
});

loadEvent();

// Reschedule flow
const moveBtn = document.getElementById('move');
const reschedCal = document.getElementById('reschedule-calendar');
const reschedLabel = document.getElementById('reschedule-label');
let selectedReschedule = null;
let allRescheduleSlots = [];

const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e) { return 'UTC'; } })();

function _addDays(d, n) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function _dayKey(iso) { return new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }); }
function _weekStart(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, weekday:'short', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const y = parts.find(p => p.type==='year').value, m = parts.find(p => p.type==='month').value, d = parts.find(p => p.type==='day').value, w = parts.find(p => p.type==='weekday').value;
  const dt = new Date(`${y}-${m}-${d}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(w));
  return dt;
}

let reschedWeekStart = _weekStart(new Date());

function renderReschedCal() {
  reschedCal.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = _addDays(reschedWeekStart, i);
    const key = _dayKey(d.toISOString());
    const col = document.createElement('div'); col.className = 'day-column';
    const hdr = document.createElement('div'); hdr.className = 'day-header';
    hdr.textContent = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', timeZone: tz });
    col.appendChild(hdr);
    const list = document.createElement('div'); list.className = 'day-slots';
    const daySlots = allRescheduleSlots.filter(s => _dayKey(s.start) === key);
    if (daySlots.length === 0) {
      const empty = document.createElement('div'); empty.className = 'slot-card'; empty.textContent = 'No slots'; empty.style.opacity = '0.5'; empty.style.cursor = 'default';
      list.appendChild(empty);
    } else {
      daySlots.forEach(s => {
        const btn = document.createElement('button'); btn.className = 'slot-card';
        btn.textContent = `${new Date(s.start).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', timeZone: tz })} — ${new Date(s.end).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', timeZone: tz })}`;
        btn.addEventListener('click', () => {
          reschedCal.querySelectorAll('.slot-card').forEach(el => el.classList.remove('selected'));
          btn.classList.add('selected');
          selectedReschedule = s;
          moveBtn.disabled = false;
        });
        list.appendChild(btn);
      });
    }
    col.appendChild(list); reschedCal.appendChild(col);
  }
  const end = _addDays(reschedWeekStart, 6);
  reschedLabel.textContent = `${reschedWeekStart.toLocaleDateString(undefined, { month:'short', day:'numeric', timeZone: tz })} — ${end.toLocaleDateString(undefined, { month:'short', day:'numeric', timeZone: tz })}`;
}

document.getElementById('reschedule-prev').addEventListener('click', () => { reschedWeekStart = _addDays(reschedWeekStart, -7); renderReschedCal(); });
document.getElementById('reschedule-next').addEventListener('click', () => { reschedWeekStart = _addDays(reschedWeekStart, 7); renderReschedCal(); });

async function loadRescheduleOptions() {
  if (!eventId) return;
  reschedCal.innerHTML = '<div style="padding:8px;color:#666">Loading...</div>';
  try {
    const res = await fetch(`/api/reschedule-options/${encodeURIComponent(eventId)}?days=60`);
    const data = await res.json();
    if (!res.ok) { reschedCal.textContent = `Error: ${data.error || res.statusText}`; return; }
    allRescheduleSlots = data.slots || [];
    reschedWeekStart = _weekStart(new Date());
    renderReschedCal();
  } catch(err) {
    reschedCal.textContent = `Network error: ${err.message}`;
  }
}

moveBtn.addEventListener('click', async () => {
  if (!selectedReschedule || !eventId) return;
  if (!confirm('Move this lesson to the selected slot?')) return;
  status.textContent = 'Moving...';
  try {
    const payload = { isoStart: selectedReschedule.start, isoEnd: selectedReschedule.end };
    const url = token ? `/api/manage/${encodeURIComponent(token)}` : `/api/event/${encodeURIComponent(eventId)}`;
    const res = await fetch(url, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { status.textContent = `Error: ${data.error || res.statusText}`; return; }
    status.textContent = 'Moved successfully.';
    await loadEvent();
    selectedReschedule = null;
    moveBtn.disabled = true;
    await loadRescheduleOptions();
  } catch(err) {
    status.textContent = `Network error: ${err.message}`;
  }
});

// load options after initial event load
setTimeout(loadRescheduleOptions, 300);
