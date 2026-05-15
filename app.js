// === NADI TRACKER APP ===

// --- DATA STORAGE ---
const Storage = {
    KEY: 'nadiTracker_data',

    getAll() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : {};
    },

    get(dateStr) {
        const all = this.getAll();
        return all[dateStr] || null;
    },

    save(dateStr, entry) {
        const all = this.getAll();
        all[dateStr] = entry;
        localStorage.setItem(this.KEY, JSON.stringify(all));
    },

    exportData() {
        return JSON.stringify(this.getAll(), null, 2);
    },

    importData(jsonStr) {
        const data = JSON.parse(jsonStr);
        localStorage.setItem(this.KEY, JSON.stringify(data));
    },

    clearAll() {
        localStorage.removeItem(this.KEY);
    }
};

// --- NADI CALCULATION ---
const NadiCalc = {
    /**
     * Get expected nadi for a given paksha and tithi
     * Shukla: 1-3 Ida, 4-6 Pingala, 7-9 Ida, 10-12 Pingala, 13-15 Ida
     * Krishna: 1-3 Pingala, 4-6 Ida, 7-9 Pingala, 10-12 Ida, 13-15 Pingala
     */
    getExpectedNadi(paksha, tithi) {
        const group = Math.ceil(tithi / 3); // 1,2,3,4,5
        const isOddGroup = group % 2 === 1;

        if (paksha === 'shukla') {
            return isOddGroup ? 'ida' : 'pingala';
        } else {
            return isOddGroup ? 'pingala' : 'ida';
        }
    },

    getNadiInfo(nadi) {
        if (nadi === 'ida') {
            return {
                name: 'Ida Nadi',
                nostril: 'Left Nostril',
                description: 'Cooling, Lunar, Calming energy - ideal for receptive tasks',
                emoji: '\u{1F319}'
            };
        } else {
            return {
                name: 'Pingala Nadi',
                nostril: 'Right Nostril',
                description: 'Heating, Solar, Active energy - ideal for dynamic tasks',
                emoji: '\u2600\uFE0F'
            };
        }
    },

    isMatch(expected, actual) {
        return expected === actual;
    }
};

// --- APP STATE ---
let state = {
    currentPage: 'home',
    selectedNadi: null,
    calendarMonth: new Date().getMonth(),
    calendarYear: new Date().getFullYear()
};

// --- DOM ELEMENTS ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Splash screen
    setTimeout(() => {
        $('#splash').classList.add('fade-out');
        setTimeout(() => {
            $('#splash').style.display = 'none';
            $('#app').classList.remove('hidden');
            initApp();
        }, 500);
    }, 1500);
});

function initApp() {
    setupNavigation();
    setupCheckin();
    setupCalendar();
    setupSettings();
    updateHomePage();
    setDefaultDate();
}

// --- NAVIGATION ---
function setupNavigation() {
    $$('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    state.currentPage = page;

    $$('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    $$('.page').forEach(p => {
        p.classList.toggle('active', p.id === `page-${page}`);
    });

    // Refresh page data
    if (page === 'home') updateHomePage();
    if (page === 'calendar') renderCalendar();
    if (page === 'stats') updateStats();
}

// --- HOME PAGE ---
function updateHomePage() {
    // For demo, we'll show what would be expected today
    // User needs to manually input paksha/tithi since we excluded auto-detect
    const allData = Storage.getAll();
    const today = getTodayStr();
    const todayEntry = allData[today];

    if (todayEntry) {
        const expected = NadiCalc.getExpectedNadi(todayEntry.paksha, todayEntry.tithi);
        const nadiInfo = NadiCalc.getNadiInfo(expected);

        $('#todayPaksha').textContent = todayEntry.paksha === 'shukla' ? 'Shukla Paksha' : 'Krishna Paksha';
        $('#todayTithi').textContent = `Tithi ${todayEntry.tithi}`;
        $('#expectedNadi').textContent = nadiInfo.emoji;
        $('#nadiDesc').textContent = nadiInfo.description;
        $('#expectedNadiText').textContent = nadiInfo.name;
        $('#expectedNostril').textContent = nadiInfo.nostril;

        const circle = $('#nadiCircle');
        circle.classList.toggle('pingala', expected === 'pingala');
    } else {
        $('#todayPaksha').textContent = 'No Check-in';
        $('#todayTithi').textContent = 'Today';
        $('#expectedNadi').textContent = '?';
        $('#nadiDesc').textContent = 'Complete your morning check-in to see today\'s nadi';
        $('#expectedNadiText').textContent = '--';
        $('#expectedNostril').textContent = '--';
    }

    // Streak
    const streak = calculateStreak();
    $('#streakCount').textContent = streak;

    // Quick stats for current month
    const monthStats = getMonthStats();
    $('#totalEarnings').textContent = `$${monthStats.total.toFixed(0)}`;
    $('#matchRate').textContent = `${monthStats.matchRate}%`;
    $('#avgEarnings').textContent = `$${monthStats.avgPerDay.toFixed(0)}`;
}

function calculateStreak() {
    const allData = Storage.getAll();
    const dates = Object.keys(allData).sort().reverse();
    let streak = 0;

    for (const dateStr of dates) {
        const entry = allData[dateStr];
        if (!entry.actualNadi) continue;
        const expected = NadiCalc.getExpectedNadi(entry.paksha, entry.tithi);
        if (NadiCalc.isMatch(expected, entry.actualNadi)) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

function getMonthStats() {
    const allData = Storage.getAll();
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let total = 0;
    let days = 0;
    let matches = 0;

    for (const [dateStr, entry] of Object.entries(allData)) {
        if (dateStr.startsWith(monthPrefix)) {
            if (entry.earnings) total += parseFloat(entry.earnings);
            if (entry.actualNadi) {
                days++;
                const expected = NadiCalc.getExpectedNadi(entry.paksha, entry.tithi);
                if (NadiCalc.isMatch(expected, entry.actualNadi)) matches++;
            }
        }
    }

    return {
        total,
        matchRate: days > 0 ? Math.round((matches / days) * 100) : 0,
        avgPerDay: days > 0 ? total / days : 0
    };
}

// --- CHECK-IN ---
function setupCheckin() {
    const idaBtn = $('#idaBtn');
    const pingalaBtn = $('#pingalaBtn');

    idaBtn.addEventListener('click', () => selectNadi('ida'));
    pingalaBtn.addEventListener('click', () => selectNadi('pingala'));
    $('#saveCheckin').addEventListener('click', saveCheckin);
}

function setDefaultDate() {
    const today = getTodayStr();
    $('#checkinDate').value = today;
}

function selectNadi(nadi) {
    state.selectedNadi = nadi;
    $('#idaBtn').classList.toggle('selected', nadi === 'ida');
    $('#pingalaBtn').classList.toggle('selected', nadi === 'pingala');
}

function saveCheckin() {
    const dateStr = $('#checkinDate').value;
    const paksha = $('#pakshaSelect').value;
    const tithi = parseInt($('#tithiSelect').value);
    const earnings = $('#earningsAmount').value;
    const notes = $('#notesField').value;
    const actualNadi = state.selectedNadi;

    if (!dateStr) {
        showToast('Please select a date');
        return;
    }

    if (!actualNadi) {
        showToast('Please select which nostril was dominant');
        return;
    }

    const expected = NadiCalc.getExpectedNadi(paksha, tithi);
    const matched = NadiCalc.isMatch(expected, actualNadi);

    const entry = {
        date: dateStr,
        paksha,
        tithi,
        expectedNadi: expected,
        actualNadi,
        matched,
        earnings: earnings ? parseFloat(earnings) : 0,
        notes,
        timestamp: Date.now()
    };

    Storage.save(dateStr, entry);

    // Show result
    const result = $('#checkinResult');
    result.classList.remove('hidden');

    if (matched) {
        $('#resultIcon').textContent = '\u2728';
        $('#resultText').textContent = `Perfect! Your ${NadiCalc.getNadiInfo(actualNadi).name} was aligned with the expected cycle.`;
    } else {
        $('#resultIcon').textContent = '\u{1F504}';
        const expectedInfo = NadiCalc.getNadiInfo(expected);
        $('#resultText').textContent = `Expected ${expectedInfo.name} but ${NadiCalc.getNadiInfo(actualNadi).name} was active. Interesting data point!`;
    }

    showToast('Check-in saved successfully!');

    // Reset form after a moment
    setTimeout(() => {
        state.selectedNadi = null;
        $('#idaBtn').classList.remove('selected');
        $('#pingalaBtn').classList.remove('selected');
        $('#earningsAmount').value = '';
        $('#notesField').value = '';
        result.classList.add('hidden');
        updateHomePage();
    }, 3000);
}

// --- CALENDAR ---
function setupCalendar() {
    $('#prevMonth').addEventListener('click', () => {
        state.calendarMonth--;
        if (state.calendarMonth < 0) {
            state.calendarMonth = 11;
            state.calendarYear--;
        }
        renderCalendar();
    });

    $('#nextMonth').addEventListener('click', () => {
        state.calendarMonth++;
        if (state.calendarMonth > 11) {
            state.calendarMonth = 0;
            state.calendarYear++;
        }
        renderCalendar();
    });

    $('#closeDetail').addEventListener('click', () => {
        $('#dayDetail').classList.add('hidden');
    });

    renderCalendar();
}

function renderCalendar() {
    const year = state.calendarYear;
    const month = state.calendarMonth;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    $('#calMonthYear').textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = getTodayStr();
    const allData = Storage.getAll();

    const container = $('#calendarDays');
    container.innerHTML = '';

    // Empty cells for days before first day
    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day empty';
        container.appendChild(cell);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = allData[dateStr];
        const cell = document.createElement('div');
        cell.className = 'cal-day';

        if (dateStr === todayStr) cell.classList.add('today');

        if (entry && entry.actualNadi) {
            cell.classList.add(entry.matched ? 'matched' : 'mismatched');
            if (entry.earnings > 0) {
                const dot = document.createElement('div');
                dot.className = 'earning-dot';
                cell.appendChild(dot);
            }
        }

        cell.textContent = day;

        cell.addEventListener('click', () => showDayDetail(dateStr, day));
        container.appendChild(cell);
    }
}

function showDayDetail(dateStr, day) {
    const entry = Storage.get(dateStr);
    const detail = $('#dayDetail');

    $('#detailDate').textContent = formatDate(dateStr);

    if (entry) {
        $('#detailPaksha').textContent = entry.paksha === 'shukla' ? 'Shukla Paksha' : 'Krishna Paksha';
        $('#detailTithi').textContent = `Tithi ${entry.tithi}`;
        $('#detailExpected').textContent = NadiCalc.getNadiInfo(entry.expectedNadi).name;
        $('#detailActual').textContent = entry.actualNadi ? NadiCalc.getNadiInfo(entry.actualNadi).name : 'Not recorded';
        $('#detailMatch').textContent = entry.matched ? '\u2705 Yes' : '\u274C No';
        $('#detailEarnings').textContent = entry.earnings ? `$${entry.earnings.toFixed(2)}` : 'Not recorded';
        $('#detailNotes').textContent = entry.notes || 'None';
    } else {
        $('#detailPaksha').textContent = 'No data';
        $('#detailTithi').textContent = '--';
        $('#detailExpected').textContent = '--';
        $('#detailActual').textContent = '--';
        $('#detailMatch').textContent = '--';
        $('#detailEarnings').textContent = '--';
        $('#detailNotes').textContent = '--';
    }

    detail.classList.remove('hidden');
}

// --- STATS ---
function updateStats() {
    const allData = Storage.getAll();
    const entries = Object.values(allData).filter(e => e.actualNadi);

    if (entries.length === 0) {
        $('#avgMatched').textContent = '$0';
        $('#avgMismatched').textContent = '$0';
        $('#totalDays').textContent = '0';
        $('#bestDay').textContent = '$0';
        $('#earningsChart').innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:40px 0;">No data yet. Start checking in!</p>';
        return;
    }

    // Calculate averages
    const matchedEntries = entries.filter(e => e.matched);
    const mismatchedEntries = entries.filter(e => !e.matched);

    const avgMatched = matchedEntries.length > 0
        ? matchedEntries.reduce((s, e) => s + (e.earnings || 0), 0) / matchedEntries.length
        : 0;

    const avgMismatched = mismatchedEntries.length > 0
        ? mismatchedEntries.reduce((s, e) => s + (e.earnings || 0), 0) / mismatchedEntries.length
        : 0;

    const bestEarning = Math.max(...entries.map(e => e.earnings || 0));

    $('#avgMatched').textContent = `$${avgMatched.toFixed(0)}`;
    $('#avgMismatched').textContent = `$${avgMismatched.toFixed(0)}`;
    $('#totalDays').textContent = entries.length;
    $('#bestDay').textContent = `$${bestEarning.toFixed(0)}`;

    // Earnings chart (last 30 entries)
    const sortedEntries = entries.sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    const maxEarning = Math.max(...sortedEntries.map(e => e.earnings || 0), 1);

    const chartContainer = $('#earningsChart');
    chartContainer.innerHTML = '';

    sortedEntries.forEach(entry => {
        const bar = document.createElement('div');
        bar.className = `chart-bar ${entry.matched ? 'matched' : 'mismatched'}`;
        const height = ((entry.earnings || 0) / maxEarning) * 100;
        bar.style.height = `${Math.max(height, 3)}%`;
        bar.title = `${entry.date}: $${(entry.earnings || 0).toFixed(2)}`;
        chartContainer.appendChild(bar);
    });

    // Comparison bars
    const maxAvg = Math.max(avgMatched, avgMismatched, 1);
    $('#matchBar').style.width = `${(avgMatched / maxAvg) * 150}px`;
    $('#mismatchBar').style.width = `${(avgMismatched / maxAvg) * 150}px`;
    $('#matchValue').textContent = `$${avgMatched.toFixed(0)}`;
    $('#mismatchValue').textContent = `$${avgMismatched.toFixed(0)}`;

    // Nadi distribution
    const idaCount = entries.filter(e => e.actualNadi === 'ida').length;
    const pingalaCount = entries.filter(e => e.actualNadi === 'pingala').length;
    const total = entries.length;

    $('#idaDist').textContent = `${Math.round((idaCount / total) * 100)}%`;
    $('#pingalaDist').textContent = `${Math.round((pingalaCount / total) * 100)}%`;
}

// --- SETTINGS ---
function setupSettings() {
    $('#settingsBtn').addEventListener('click', () => {
        $('#settingsModal').classList.remove('hidden');
    });

    $('#closeSettings').addEventListener('click', () => {
        $('#settingsModal').classList.add('hidden');
    });

    $('#exportData').addEventListener('click', () => {
        const data = Storage.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nadi-tracker-backup-${getTodayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Data exported successfully!');
    });

    $('#importData').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                Storage.importData(event.target.result);
                showToast('Data imported successfully!');
                updateHomePage();
            } catch (err) {
                showToast('Error importing data. Invalid file.');
            }
        };
        reader.readAsText(file);
    });

    $('#clearData').addEventListener('click', () => {
        if (confirm('Are you sure? This will delete ALL your tracking data permanently.')) {
            Storage.clearAll();
            showToast('All data cleared');
            updateHomePage();
        }
    });

    // Close modal on backdrop click
    $('#settingsModal').addEventListener('click', (e) => {
        if (e.target === $('#settingsModal')) {
            $('#settingsModal').classList.add('hidden');
        }
    });

    $('#dayDetail').addEventListener('click', (e) => {
        if (e.target === $('#dayDetail')) {
            $('#dayDetail').classList.add('hidden');
        }
    });
}

// --- UTILITIES ---
function getTodayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showToast(message) {
    const toast = $('#toast');
    $('#toastText').textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2500);
}

// --- SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW registration failed:', err));
    });
}
