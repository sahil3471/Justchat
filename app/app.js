// app.js — Nadi Tracker UI logic. Pure browser, no build step.
// Data model (one entry per day, keyed by YYYY-MM-DD local date):
//   { date, actualNadi: 'ida'|'pingla'|null, earnings: number|null,
//     hours: number|null, notes: string }
// We do NOT store expectedNadi/tithi — we recompute deterministically from date.

const STORAGE_KEY = 'nadi-tracker-v1';
const A = window.Astro;

// ---------- Storage ----------
function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (e) { return {}; }
}
function saveAll(obj) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}
function getEntry(dateStr) {
  const all = loadAll();
  return all[dateStr] || null;
}
function setEntry(dateStr, entry) {
  const all = loadAll();
  if (entry === null) delete all[dateStr];
  else all[dateStr] = entry;
  saveAll(all);
}

// ---------- App state ----------
const state = {
  selectedDate: A.ymdLocal(new Date()),  // string YYYY-MM-DD
  calMonth: monthStart(new Date()),       // Date pointing at 1st of cal month
  statMonth: monthStart(new Date()),
  trendChart: null,
};

function monthStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function todayStr() { return A.ymdLocal(new Date()); }

// ---------- Tabs ----------
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab').forEach(t =>
        t.classList.toggle('active', t.id === 'tab-' + tab));
      if (tab === 'calendar') renderCalendar();
      if (tab === 'stats') renderStats();
      if (tab === 'history') renderHistory();
    });
  });
}

// ---------- Today tab ----------
function fmtDateButton(dateStr) {
  const d = A.parseYmd(dateStr);
  const t = todayStr();
  const y = A.ymdLocal(new Date(Date.now() - 86400000));
  if (dateStr === t) return 'Today, ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (dateStr === y) return 'Yesterday, ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

function renderToday() {
  const dateStr = state.selectedDate;
  const local = A.parseYmd(dateStr);
  const info = A.dayInfo(local);
  const entry = getEntry(dateStr) || {};

  // Top date button
  document.getElementById('todayDate').textContent = fmtDateButton(dateStr);

  // Tithi card
  const pakshaBadge = document.getElementById('pakshaBadge');
  pakshaBadge.textContent = info.paksha === 'shukla' ? 'Shukla Paksha' : 'Krishna Paksha';
  pakshaBadge.className = 'badge ' + info.paksha;
  document.getElementById('tithiName').textContent =
    `${info.tithiName} (${info.paksha === 'shukla' ? 'S' : 'K'}${info.pakshaDay})`;
  const sr = info.sunrise;
  document.getElementById('sunriseLine').textContent = sr
    ? 'Sunrise (Halifax): ' + sr.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : 'Sunrise: n/a';

  // Expected nadi
  const exp = info.expectedNadi;
  const expEl = document.getElementById('expectedNadi');
  expEl.textContent = exp === 'ida' ? 'Ida' : 'Pingla';
  expEl.className = 'nadi-value ' + exp;

  // Actual nadi buttons
  document.querySelectorAll('.nadi-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nadi === entry.actualNadi);
  });

  // Match banner
  const banner = document.getElementById('matchBanner');
  if (entry.actualNadi) {
    const match = entry.actualNadi === exp;
    banner.classList.remove('hidden');
    banner.classList.toggle('match', match);
    banner.classList.toggle('mismatch', !match);
    banner.textContent = match ? '✓ Match — actual aligned with expected' : '✗ Mismatch — actual differed from expected';
  } else {
    banner.classList.add('hidden');
  }

  // Form fields
  document.getElementById('earnings').value = entry.earnings != null ? entry.earnings : '';
  document.getElementById('hours').value = entry.hours != null ? entry.hours : '';
  document.getElementById('notes').value = entry.notes || '';
  document.getElementById('saveStatus').textContent = '';

  // Derived
  const dph = document.getElementById('dollarsPerHour');
  if (entry.earnings != null && entry.hours != null && entry.hours > 0) {
    dph.textContent = '$' + (entry.earnings / entry.hours).toFixed(2);
  } else {
    dph.textContent = '—';
  }
  const matchPill = document.getElementById('matchPill');
  if (entry.actualNadi) {
    matchPill.textContent = entry.actualNadi === exp ? 'Match' : 'Mismatch';
    matchPill.style.color = entry.actualNadi === exp ? 'var(--match)' : 'var(--mismatch)';
  } else {
    matchPill.textContent = '—';
    matchPill.style.color = '';
  }
}

function bindTodayHandlers() {
  document.getElementById('prevDay').addEventListener('click', () => {
    state.selectedDate = shiftDate(state.selectedDate, -1);
    renderToday();
  });
  document.getElementById('nextDay').addEventListener('click', () => {
    state.selectedDate = shiftDate(state.selectedDate, 1);
    renderToday();
  });
  document.getElementById('todayDate').addEventListener('click', () => {
    state.selectedDate = todayStr();
    renderToday();
  });
  document.querySelectorAll('.nadi-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dateStr = state.selectedDate;
      const cur = getEntry(dateStr) || newEntry(dateStr);
      // Toggle off if same value clicked again
      cur.actualNadi = (cur.actualNadi === btn.dataset.nadi) ? null : btn.dataset.nadi;
      setEntry(dateStr, cur);
      renderToday();
    });
  });
  document.getElementById('saveBtn').addEventListener('click', () => {
    const dateStr = state.selectedDate;
    const cur = getEntry(dateStr) || newEntry(dateStr);
    const earningsRaw = document.getElementById('earnings').value;
    const hoursRaw = document.getElementById('hours').value;
    cur.earnings = earningsRaw === '' ? null : Number(earningsRaw);
    cur.hours = hoursRaw === '' ? null : Number(hoursRaw);
    cur.notes = document.getElementById('notes').value.trim();
    setEntry(dateStr, cur);
    document.getElementById('saveStatus').textContent = 'Saved.';
    setTimeout(() => {
      const el = document.getElementById('saveStatus');
      if (el.textContent === 'Saved.') el.textContent = '';
    }, 1500);
    renderToday();
  });
  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (!confirm('Delete entry for this day?')) return;
    setEntry(state.selectedDate, null);
    renderToday();
  });
}

function newEntry(dateStr) {
  return { date: dateStr, actualNadi: null, earnings: null, hours: null, notes: '' };
}
function shiftDate(dateStr, days) {
  const d = A.parseYmd(dateStr);
  d.setDate(d.getDate() + days);
  return A.ymdLocal(d);
}

// ---------- Calendar tab ----------
function renderCalendar() {
  const monthDate = state.calMonth;
  document.getElementById('calTitle').textContent =
    monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const firstDow = monthDate.getDay(); // 0=Sun
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const all = loadAll();

  // Compute max earnings in this month for size scaling
  let maxE = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = A.ymdLocal(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
    const e = all[ds];
    if (e && e.earnings) maxE = Math.max(maxE, e.earnings);
  }

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  for (let i = 0; i < firstDow; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty-month';
    grid.appendChild(cell);
  }
  const t = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const local = new Date(monthDate.getFullYear(), monthDate.getMonth(), d);
    const ds = A.ymdLocal(local);
    const info = A.dayInfo(local);
    const entry = all[ds];

    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    if (ds === t) cell.classList.add('today');
    if (entry) {
      cell.classList.add('has-log');
      if (entry.actualNadi) {
        const match = entry.actualNadi === info.expectedNadi;
        cell.classList.add(match ? 'match' : 'mismatch');
      }
    }
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = d;
    cell.appendChild(num);

    // Earnings blob — scale opacity by magnitude
    if (entry && entry.earnings && maxE > 0) {
      const blob = document.createElement('div');
      blob.className = 'blob';
      const ratio = Math.max(0.15, entry.earnings / maxE);
      blob.style.opacity = (0.10 + 0.45 * ratio).toFixed(2);
      cell.insertBefore(blob, num);
    }

    // Tiny expected nadi mark
    const mark = document.createElement('div');
    mark.className = 'nadi-mark';
    mark.textContent = info.expectedNadi === 'ida' ? 'I' : 'P';
    mark.style.color = info.expectedNadi === 'ida' ? 'var(--ida)' : 'var(--pingla)';
    cell.appendChild(mark);

    cell.addEventListener('click', () => {
      state.selectedDate = ds;
      // switch to Today tab
      document.querySelector('.tab-btn[data-tab="today"]').click();
      renderToday();
    });
    grid.appendChild(cell);
  }
}

function bindCalendarHandlers() {
  document.getElementById('calPrev').addEventListener('click', () => {
    state.calMonth = addMonths(state.calMonth, -1); renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click', () => {
    state.calMonth = addMonths(state.calMonth, 1); renderCalendar();
  });
}

// ---------- Stats tab ----------
function entriesArray() {
  const all = loadAll();
  return Object.values(all).sort((a, b) => a.date.localeCompare(b.date));
}

function renderStats() {
  const entries = entriesArray();
  // Enrich with computed expected
  const enriched = entries.map(e => {
    const info = A.dayInfo(A.parseYmd(e.date));
    return { ...e, expected: info.expectedNadi, paksha: info.paksha };
  });

  // KPIs
  const logged = enriched.filter(e => e.actualNadi);
  const matched = logged.filter(e => e.actualNadi === e.expected);
  document.getElementById('kpiDays').textContent = enriched.length;
  document.getElementById('kpiMatchPct').textContent = logged.length
    ? Math.round((matched.length / logged.length) * 100) + '%' : '—';

  // Streaks of matched days (consecutive calendar days with match)
  const { current, longest } = streaks(enriched);
  document.getElementById('kpiStreak').textContent = current;
  document.getElementById('kpiLongest').textContent = longest;

  // Earnings splits
  const withE = enriched.filter(e => e.earnings != null && e.actualNadi);
  const matchedE = withE.filter(e => e.actualNadi === e.expected).map(e => e.earnings);
  const mismatchE = withE.filter(e => e.actualNadi !== e.expected).map(e => e.earnings);
  renderSplit('splitMatch', [
    { label: 'Match', values: matchedE },
    { label: 'Mismatch', values: mismatchE },
  ]);

  const expIda = enriched.filter(e => e.earnings != null && e.expected === 'ida').map(e => e.earnings);
  const expPin = enriched.filter(e => e.earnings != null && e.expected === 'pingla').map(e => e.earnings);
  renderSplit('splitExpected', [
    { label: 'Ida days', values: expIda },
    { label: 'Pingla days', values: expPin },
  ]);

  const shukla = enriched.filter(e => e.earnings != null && e.paksha === 'shukla').map(e => e.earnings);
  const krishna = enriched.filter(e => e.earnings != null && e.paksha === 'krishna').map(e => e.earnings);
  renderSplit('splitPaksha', [
    { label: 'Shukla', values: shukla },
    { label: 'Krishna', values: krishna },
  ]);

  // Monthly summary
  renderMonthSummary(enriched);

  // Trend chart
  renderTrend(enriched);
}

function avg(arr) { return arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0; }
function sum(arr) { return arr.reduce((s, x) => s + x, 0); }

function renderSplit(elId, rows) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  const maxAvg = Math.max(1, ...rows.map(r => avg(r.values)));
  rows.forEach(r => {
    const a = avg(r.values);
    const row = document.createElement('div');
    row.className = 'split-row';
    row.innerHTML = `
      <div class="split-label">${r.label} <span class="muted">(${r.values.length})</span></div>
      <div class="split-bar"><div style="width:${(a / maxAvg * 100).toFixed(1)}%"></div></div>
      <div class="split-value">${r.values.length ? '$' + a.toFixed(2) : '—'}</div>
    `;
    el.appendChild(row);
  });
}

function renderMonthSummary(enriched) {
  const m = state.statMonth;
  document.getElementById('statMonthLabel').textContent =
    m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const ymPrefix = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-`;
  const inMonth = enriched.filter(e => e.date.startsWith(ymPrefix));
  const earnings = inMonth.filter(e => e.earnings != null).map(e => e.earnings);
  const hours = inMonth.filter(e => e.hours != null).map(e => e.hours);
  const logged = inMonth.filter(e => e.actualNadi);
  const matched = logged.filter(e => e.actualNadi === e.expected);

  const tot = sum(earnings);
  const totH = sum(hours);
  const dph = totH > 0 ? tot / totH : null;

  const html = `
    <div class="kpi"><div class="kpi-label">Total $</div><div class="kpi-value">$${tot.toFixed(0)}</div></div>
    <div class="kpi"><div class="kpi-label">Avg/day</div><div class="kpi-value">${earnings.length ? '$' + (tot / earnings.length).toFixed(2) : '—'}</div></div>
    <div class="kpi"><div class="kpi-label">Hours</div><div class="kpi-value">${totH.toFixed(1)}</div></div>
    <div class="kpi"><div class="kpi-label">$/hour</div><div class="kpi-value">${dph != null ? '$' + dph.toFixed(2) : '—'}</div></div>
    <div class="kpi"><div class="kpi-label">Days logged</div><div class="kpi-value">${inMonth.length}</div></div>
    <div class="kpi"><div class="kpi-label">Match %</div><div class="kpi-value">${logged.length ? Math.round(matched.length / logged.length * 100) + '%' : '—'}</div></div>
  `;
  document.getElementById('monthSummary').innerHTML = html;
}

function renderTrend(enriched) {
  const ctx = document.getElementById('trendChart');
  if (!ctx || typeof Chart === 'undefined') return;
  const data = enriched.filter(e => e.earnings != null);
  if (state.trendChart) { state.trendChart.destroy(); state.trendChart = null; }
  if (!data.length) return;
  const labels = data.map(e => e.date.slice(5));
  const values = data.map(e => e.earnings);
  const colors = data.map(e => {
    if (!e.actualNadi) return '#8a93a3';
    return e.actualNadi === e.expected ? '#4ade80' : '#f87171';
  });
  state.trendChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Earnings',
        data: values,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8a93a3', autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } },
        y: { ticks: { color: '#8a93a3' }, grid: { color: '#262c37' } }
      }
    }
  });
}

function streaks(enriched) {
  // Streak = consecutive calendar days where actualNadi matches expected.
  // Sort by date ascending.
  const map = new Map(enriched.map(e => [e.date, e]));
  // Determine the date range
  const dates = enriched.map(e => e.date).sort();
  if (!dates.length) return { current: 0, longest: 0 };
  const start = A.parseYmd(dates[0]);
  const end = new Date();
  let longest = 0, run = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = A.ymdLocal(d);
    const e = map.get(ds);
    const info = A.dayInfo(d);
    if (e && e.actualNadi && e.actualNadi === info.expectedNadi) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  // Current streak: count back from today
  let current = 0;
  for (let d = new Date(); ; d.setDate(d.getDate() - 1)) {
    const ds = A.ymdLocal(d);
    const e = map.get(ds);
    const info = A.dayInfo(d);
    if (e && e.actualNadi && e.actualNadi === info.expectedNadi) current += 1;
    else break;
    if (current > 1000) break;
  }
  return { current, longest };
}

function bindStatsHandlers() {
  document.getElementById('statMonthPrev').addEventListener('click', () => {
    state.statMonth = addMonths(state.statMonth, -1); renderStats();
  });
  document.getElementById('statMonthNext').addEventListener('click', () => {
    state.statMonth = addMonths(state.statMonth, 1); renderStats();
  });
}

// ---------- History tab ----------
function renderHistory() {
  const list = document.getElementById('historyList');
  const entries = entriesArray().reverse();
  if (!entries.length) {
    list.innerHTML = '<div class="muted">No entries yet. Log your first day on the Today tab.</div>';
    return;
  }
  list.innerHTML = '';
  for (const e of entries) {
    const info = A.dayInfo(A.parseYmd(e.date));
    const item = document.createElement('div');
    item.className = 'history-item';
    const matchTxt = e.actualNadi
      ? (e.actualNadi === info.expectedNadi ? 'Match' : 'Mismatch')
      : '—';
    const matchCls = e.actualNadi
      ? (e.actualNadi === info.expectedNadi ? 'match' : 'mismatch')
      : '';
    item.innerHTML = `
      <div>
        <div class="hi-date">${e.date} · ${info.tithiName} (${info.paksha === 'shukla' ? 'S' : 'K'}${info.pakshaDay})</div>
        <div class="hi-meta">
          exp: ${info.expectedNadi} · act: ${e.actualNadi || '—'} ·
          ${e.hours != null ? e.hours + 'h' : '—'}
          ${e.notes ? ' · ' + e.notes.replace(/[<>]/g, '') : ''}
        </div>
      </div>
      <div>
        <div class="hi-amount">${e.earnings != null ? '$' + e.earnings.toFixed(2) : '—'}</div>
        <div class="hi-mark ${matchCls}">${matchTxt}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      state.selectedDate = e.date;
      document.querySelector('.tab-btn[data-tab="today"]').click();
      renderToday();
    });
    list.appendChild(item);
  }
}

function bindHistoryHandlers() {
  document.getElementById('exportBtn').addEventListener('click', exportCsv);
  document.getElementById('importFile').addEventListener('change', importCsv);
}

// ---------- CSV ----------
function exportCsv() {
  const entries = entriesArray();
  const header = ['date', 'paksha', 'paksha_day', 'tithi_name', 'expected_nadi', 'actual_nadi', 'match', 'earnings_cad', 'hours', 'dollars_per_hour', 'notes'];
  const lines = [header.join(',')];
  for (const e of entries) {
    const info = A.dayInfo(A.parseYmd(e.date));
    const match = e.actualNadi ? (e.actualNadi === info.expectedNadi ? '1' : '0') : '';
    const dph = (e.earnings != null && e.hours != null && e.hours > 0)
      ? (e.earnings / e.hours).toFixed(2) : '';
    const row = [
      e.date,
      info.paksha,
      info.pakshaDay,
      info.tithiName,
      info.expectedNadi,
      e.actualNadi || '',
      match,
      e.earnings != null ? e.earnings : '',
      e.hours != null ? e.hours : '',
      dph,
      csvField(e.notes || '')
    ];
    lines.push(row.join(','));
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nadi-tracker-' + todayStr() + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function csvField(s) {
  if (/[,"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function importCsv(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const rows = parseCsv(e.target.result);
      const header = rows.shift();
      const idx = name => header.indexOf(name);
      let added = 0;
      for (const r of rows) {
        if (!r[idx('date')]) continue;
        const cur = {
          date: r[idx('date')],
          actualNadi: r[idx('actual_nadi')] || null,
          earnings: r[idx('earnings_cad')] === '' ? null : Number(r[idx('earnings_cad')]),
          hours: r[idx('hours')] === '' ? null : Number(r[idx('hours')]),
          notes: r[idx('notes')] || ''
        };
        setEntry(cur.date, cur);
        added++;
      }
      alert(`Imported ${added} entries.`);
      renderHistory();
    } catch (err) {
      alert('Could not import: ' + err.message);
    } finally {
      ev.target.value = '';
    }
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const rows = []; let cur = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.length && r.some(x => x !== ''));
}

// ---------- Init ----------
function init() {
  initTabs();
  bindTodayHandlers();
  bindCalendarHandlers();
  bindStatsHandlers();
  bindHistoryHandlers();
  renderToday();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
