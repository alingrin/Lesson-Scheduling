const params = new URLSearchParams(window.location.search);
const isoStart = params.get('isoStart');
const isoEnd = params.get('isoEnd');
const tzParam = params.get('tz') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const slotInfo = document.getElementById('slot-info');
if (!isoStart || !isoEnd) {
  slotInfo.textContent = 'Missing slot information.';
} else {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  slotInfo.textContent = `${s.toLocaleString(undefined, { timeZone: tzParam })} — ${e.toLocaleTimeString(undefined, { timeZone: tzParam })}`;
  document.querySelector('input[name=isoStart]').value = isoStart;
  document.querySelector('input[name=isoEnd]').value = isoEnd;
  // store tz in form so server-side flows or redirects can include it if desired
  const existing = document.querySelector('input[name=tz]');
  if (!existing) {
    const f = document.createElement('input'); f.type = 'hidden'; f.name = 'tz'; f.value = tzParam; document.getElementById('confirm-form').appendChild(f);
  }
}

const form = document.getElementById('confirm-form');
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  document.getElementById('status').textContent = 'Booking...';
  try {
    const res = await fetch('/api/book', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const text = await res.text();
    if (!res.ok) {
      let body = text;
      try { body = JSON.parse(text); } catch (e) {}
      document.getElementById('status').textContent = `Error: ${body.error || res.statusText}`;
      return;
    }
    const dataResp = JSON.parse(text);
    document.getElementById('status').textContent = 'Booked!';
    if (dataResp.manageToken) {
      const link = document.createElement('a');
      link.href = `/manage.html?token=${encodeURIComponent(dataResp.manageToken)}`;
      link.textContent = 'Manage your booking';
      const container = document.getElementById('booking-links');
      if (container) {
        container.innerHTML = '';
        container.appendChild(link);
      } else {
        document.getElementById('status').appendChild(document.createElement('br'));
        document.getElementById('status').appendChild(link);
      }
    } else if (dataResp.event && dataResp.event.id) {
      const link = document.createElement('a');
      link.href = `/manage.html?eventId=${encodeURIComponent(dataResp.event.id)}&email=${encodeURIComponent(data.studentEmail)}`;
      link.textContent = 'Manage your booking';
      const container = document.getElementById('booking-links');
      if (container) {
        container.innerHTML = '';
        container.appendChild(link);
      } else {
        document.getElementById('status').appendChild(document.createElement('br'));
        document.getElementById('status').appendChild(link);
      }
    }
  } catch (err) {
    document.getElementById('status').textContent = `Network error: ${err.message}`;
  }
});
