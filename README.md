# Nadi Tracker

A personal Progressive Web App (PWA) that tracks the **expected nadi at sunrise**
(derived from the lunar tithi — Shukla / Krishna Paksha) against the **actual
nadi** you observe, alongside daily Uber Eats earnings and hours worked.

Built for one user (Halifax, Canada). All data lives in your browser
(`localStorage`) — nothing leaves your phone.

## Features

- **Auto tithi & sunrise** for Halifax — the app figures out today's paksha and
  pakshaday and shows the expected nadi (Ida / Pingla) without any manual entry.
- **One-tap actual nadi entry** + match indicator.
- **Earnings & hours per day**, with auto-derived `$/hour`.
- **Calendar heatmap** — green = match, red = mismatch, blob size scaled by
  earnings.
- **Stats:** current and longest match streak, match %, average earnings on
  match vs mismatch days, by expected nadi, and by paksha.
- **Monthly summary:** total earnings, hours, $/hour, days logged, match %.
- **Trend chart** of earnings over time, color-coded by match outcome.
- **CSV export / import** for backup or spreadsheet analysis.
- **Offline-first** — once cached, the app works with no network.

## How the nadi pattern works

Per the user's tradition, alternating in groups of three pakshadays:

| Day in paksha | Shukla | Krishna |
|---|---|---|
| 1, 2, 3       | Ida    | Pingla  |
| 4, 5, 6       | Pingla | Ida     |
| 7, 8, 9       | Ida    | Pingla  |
| 10, 11, 12    | Pingla | Ida     |
| 13, 14, 15    | Ida    | Pingla  |

Tithi is computed at the *local sunrise instant* (Halifax: 44.6488° N, 63.5752° W),
which is the moment that matters for the practice — calendars elsewhere may
report a different "today's tithi" because tithi changes throughout the day.

## Run it on your phone

The app is hosted on GitHub Pages. After this branch is merged to `main` (or
Pages is pointed at this branch), open the URL on your phone and "Add to Home
Screen":

1. Push this repo to `main`, then on GitHub:
   **Settings → Pages → Build from branch → `main` → folder `/app`**.
2. GitHub gives you a URL like
   `https://<your-username>.github.io/Justchat/`.
3. On your phone, open that URL in **Chrome** (Android) or **Safari** (iOS):
   - **Chrome:** menu (⋮) → *Install app* / *Add to Home screen*.
   - **Safari:** share button → *Add to Home Screen*.
4. Launch from the home-screen icon — it'll open full-screen, no browser chrome,
   and continue working without internet.

### Run it locally first (any computer)

```bash
cd app
python3 -m http.server 8000
# open http://localhost:8000 in a browser
```

## File layout

```
app/
  index.html            # UI shell, four bottom tabs
  styles.css            # mobile-first dark theme
  astro.js              # tithi + sunrise calculations (Meeus algorithms)
  app.js                # storage, rendering, stats, CSV I/O
  manifest.webmanifest  # PWA manifest
  service-worker.js     # offline cache
  icons/                # 192/512/maskable PNG icons
scripts/
  make_icons.py         # regenerates icons (stdlib only)
```

## Data model

One entry per local calendar date, keyed `YYYY-MM-DD`:

```js
{
  date: '2026-05-16',
  actualNadi: 'ida' | 'pingla' | null,
  earnings: 187.50 | null,    // CAD
  hours: 6.5 | null,
  notes: 'rainy day'
}
```

`expectedNadi`, `tithi`, `paksha`, and `pakshaDay` are **never stored** — they
are recomputed deterministically from the date, so a code fix to the astro
module retroactively corrects every past entry without a migration.

## Notes

- Tithi calculation uses Meeus low-precision algorithms (sun + main moon
  periodic terms). Accurate to well within one tithi (12° elongation), which
  is all that's needed to decide "shukla 7 vs shukla 8".
- Match streak is computed across **calendar days** between your earliest log
  and today. A day with no `actualNadi` breaks the streak.
- The Chart.js library is loaded from a CDN on first run and then cached by
  the service worker for offline use.
