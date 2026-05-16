// astro.js — Astronomical calculations for tithi and sunrise.
// Self-contained, no dependencies. Accurate to within a few minutes for sunrise
// and well within a tithi for the moon-sun elongation, which is what we need.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function norm360(x) {
  x = x % 360;
  return x < 0 ? x + 360 : x;
}

// Julian Day for a JS Date treated as UTC instant.
function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// Sun's apparent ecliptic longitude (degrees), Meeus low-precision (ch. 25).
function sunLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const L0 = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = norm360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mr = M * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  return norm360(appLong);
}

// Moon's apparent ecliptic longitude (degrees). Main periodic terms from Meeus.
// Accurate to ~0.1° — easily enough since each tithi spans 12°.
function moonLongitude(jd) {
  const T = (jd - 2451545.0) / 36525;
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T +
    (T * T * T) / 538841 - (T * T * T * T) / 65194000);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T +
    (T * T * T) / 545868 - (T * T * T * T) / 113065000);
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T +
    (T * T * T) / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T +
    (T * T * T) / 69699 - (T * T * T * T) / 14712000);
  const F = norm360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T -
    (T * T * T) / 3526000 + (T * T * T * T) / 863310000);

  const Dr = D * DEG, Mr = M * DEG, Mpr = Mp * DEG, Fr = F * DEG;

  // Top periodic terms (degrees).
  let dL =
    6.288774 * Math.sin(Mpr) +
    1.274027 * Math.sin(2 * Dr - Mpr) +
    0.658314 * Math.sin(2 * Dr) +
    0.213618 * Math.sin(2 * Mpr) +
    -0.185116 * Math.sin(Mr) +
    -0.114332 * Math.sin(2 * Fr) +
    0.058793 * Math.sin(2 * Dr - 2 * Mpr) +
    0.057066 * Math.sin(2 * Dr - Mr - Mpr) +
    0.053322 * Math.sin(2 * Dr + Mpr) +
    0.045758 * Math.sin(2 * Dr - Mr) +
    -0.040923 * Math.sin(Mr - Mpr) +
    -0.034720 * Math.sin(Dr) +
    -0.030383 * Math.sin(Mr + Mpr);

  return norm360(Lp + dL);
}

// Tithi number 1..30 at a given instant. 1..15 = Shukla, 16..30 = Krishna.
// Tithi 30 = Amavasya (new moon), Tithi 15 = Purnima (full moon).
function tithiAt(date) {
  const jd = julianDay(date);
  const elong = norm360(moonLongitude(jd) - sunLongitude(jd));
  const tNum = Math.floor(elong / 12) + 1; // 1..30
  return tNum;
}

// Returns { tithi: 1..30, paksha: 'shukla'|'krishna', day: 1..15, name }.
function tithiInfo(date) {
  const t = tithiAt(date);
  if (t <= 15) {
    return { tithi: t, paksha: 'shukla', day: t, name: pakshaName('shukla', t) };
  }
  return { tithi: t, paksha: 'krishna', day: t - 15, name: pakshaName('krishna', t - 15) };
}

const TITHI_NAMES = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'
];
function pakshaName(paksha, day) {
  if (paksha === 'shukla' && day === 15) return 'Purnima';
  if (paksha === 'krishna' && day === 15) return 'Amavasya';
  return TITHI_NAMES[day - 1];
}

// Sunrise time at lat/lng for the local calendar date `dateLocal` (a Date whose
// Y/M/D in *local time* identify the day we want sunrise for).
// Returns a Date (UTC instant) of sunrise, or null if no sunrise (polar).
// Algorithm: NOAA-style low-precision; iterates twice for accuracy.
function sunriseFor(dateLocal, lat, lng) {
  // Use noon UTC of the given local date as a starting point.
  const y = dateLocal.getFullYear();
  const m = dateLocal.getMonth();
  const d = dateLocal.getDate();
  let jd = julianDay(new Date(Date.UTC(y, m, d, 12, 0, 0)));

  let result = null;
  for (let i = 0; i < 2; i++) {
    const T = (jd - 2451545.0) / 36525;
    // Sun ecliptic longitude
    const L = sunLongitude(jd);
    // Obliquity of ecliptic
    const eps = 23.439291 - 0.0130042 * T;
    // Declination
    const decl = Math.asin(Math.sin(eps * DEG) * Math.sin(L * DEG)) * RAD;
    // Equation of time (minutes), Meeus approximation
    const M = norm360(357.52911 + 35999.05029 * T);
    const e = 0.016708634 - 0.000042037 * T;
    const y2 = Math.tan((eps / 2) * DEG) ** 2;
    const L0 = norm360(280.46646 + 36000.76983 * T);
    const Eot =
      4 * RAD *
      (y2 * Math.sin(2 * L0 * DEG) -
        2 * e * Math.sin(M * DEG) +
        4 * e * y2 * Math.sin(M * DEG) * Math.cos(2 * L0 * DEG) -
        0.5 * y2 * y2 * Math.sin(4 * L0 * DEG) -
        1.25 * e * e * Math.sin(2 * M * DEG));
    // Hour angle for sunrise (refraction + solar disk = -0.833°)
    const cosH =
      (Math.sin(-0.833 * DEG) - Math.sin(lat * DEG) * Math.sin(decl * DEG)) /
      (Math.cos(lat * DEG) * Math.cos(decl * DEG));
    if (cosH > 1 || cosH < -1) return null;
    const H = Math.acos(cosH) * RAD; // degrees
    // Solar noon UTC in minutes
    const noonUtcMin = 720 - 4 * lng - Eot;
    const sunriseUtcMin = noonUtcMin - 4 * H;
    result = new Date(Date.UTC(y, m, d, 0, 0, 0) + sunriseUtcMin * 60000);
    jd = julianDay(result); // refine once
  }
  return result;
}

// Public Halifax helpers (defaults).
const HALIFAX = { lat: 44.6488, lng: -63.5752 };

// For a given local calendar date, get the tithi *at sunrise* and the
// expected nadi based on the user's pattern.
function dayInfo(dateLocal, loc = HALIFAX) {
  const sr = sunriseFor(dateLocal, loc.lat, loc.lng);
  const at = sr || dateLocal;
  const info = tithiInfo(at);
  const expectedNadi = expectedNadiFor(info.paksha, info.day);
  return {
    date: ymdLocal(dateLocal),
    sunrise: sr,
    tithi: info.tithi,
    paksha: info.paksha,
    pakshaDay: info.day,
    tithiName: info.name,
    expectedNadi
  };
}

// Nadi pattern (user-confirmed):
//   Shukla 1,2,3 = Ida   | 4,5,6 = Pingla | 7,8,9 = Ida | 10,11,12 = Pingla | 13,14,15 = Ida
//   Krishna 1,2,3 = Pingla | 4,5,6 = Ida  | 7,8,9 = Pingla | 10,11,12 = Ida | 13,14,15 = Pingla
function expectedNadiFor(paksha, day) {
  // Group index: 0..4 for groups of 3
  const g = Math.floor((day - 1) / 3); // 0..4
  // Shukla: g even -> Ida, g odd -> Pingla
  // Krishna: opposite
  const shuklaIda = (g % 2 === 0);
  const isIda = paksha === 'shukla' ? shuklaIda : !shuklaIda;
  return isIda ? 'ida' : 'pingla';
}

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

window.Astro = {
  julianDay, sunLongitude, moonLongitude,
  tithiAt, tithiInfo, sunriseFor,
  dayInfo, expectedNadiFor, HALIFAX,
  ymdLocal, parseYmd
};
