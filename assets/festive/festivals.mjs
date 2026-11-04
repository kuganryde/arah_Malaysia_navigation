// festive v0.2.0
// Malaysia's festival calendar and colour themes. Pure logic (no DOM) so it is unit-tested in Node.
// Dates: fixed ones are exact. Moon-based ones are computed (Intl Chinese / Umm al-Qura calendars, a lunar-phase
// formula) or taken from a table, and can be off by a day because Malaysia announces them after moon sighting.
// Each festival shows a lead-in before the day and a tail after, so a one-day error is invisible, and the user can
// always pick a festival by hand.

export const FESTIVALS = [
  { id: 'cny', rule: ['chinese', 1, 1], lead: 14, tail: 15, motifs: ['lantern', 'coin', 'blossom'], c1: '#e11d2e', c2: '#ffc933', c3: '#ff7a1a',
    name: { ms: 'Tahun Baru Cina', en: 'Chinese New Year', zh: '农历新年', ta: 'சீனப் புத்தாண்டு' }, hi: { ms: 'Gong Xi Fa Cai', en: 'Gong Xi Fa Cai', zh: '新年快乐 · 恭喜发财', ta: 'சீனப் புத்தாண்டு வாழ்த்துகள்' } },
  { id: 'ramadan', rule: ['hijri', 9, 1], lead: 1, tail: 28, motifs: ['crescent', 'pelita', 'star'], c1: '#14b8a6', c2: '#fcd34d', c3: '#e2e8f0', calm: true,
    name: { ms: 'Ramadan', en: 'Ramadan', zh: '斋戒月', ta: 'ரமலான்' }, hi: { ms: 'Selamat Berpuasa', en: 'Ramadan Mubarak', zh: '斋戒月平安', ta: 'ரமலான் வாழ்த்துகள்' } },
  { id: 'raya', rule: ['hijri', 10, 1], lead: 3, tail: 7, motifs: ['ketupat', 'crescent', 'pelita'], c1: '#10b981', c2: '#fcd34d', c3: '#f8fafc',
    name: { ms: 'Hari Raya Aidilfitri', en: 'Hari Raya Aidilfitri', zh: '开斋节', ta: 'ஹரி ராயா ஐடில்பித்ரி' }, hi: { ms: 'Selamat Hari Raya · Maaf Zahir & Batin', en: 'Selamat Hari Raya · Maaf Zahir & Batin', zh: '开斋节快乐', ta: 'ஹரி ராயா வாழ்த்துகள்' } },
  { id: 'haji', rule: ['hijri', 12, 10], lead: 5, tail: 3, motifs: ['crescent', 'star', 'pelita'], c1: '#059669', c2: '#fde68a', c3: '#f8fafc',
    name: { ms: 'Hari Raya Aidiladha', en: 'Hari Raya Aidiladha', zh: '哈芝节', ta: 'ஹரி ராயா ஹாஜி' }, hi: { ms: 'Selamat Hari Raya Aidiladha', en: 'Selamat Hari Raya Aidiladha', zh: '哈芝节快乐', ta: 'ஹரி ராயா ஹாஜி வாழ்த்துகள்' } },
  { id: 'muharram', rule: ['hijri', 1, 1], lead: 2, tail: 1, motifs: ['crescent', 'star'], c1: '#16a34a', c2: '#fde68a', c3: '#f8fafc', calm: true,
    name: { ms: 'Awal Muharram', en: 'Awal Muharram', zh: '伊斯兰新年', ta: 'அவல் முஹர்ரம்' }, hi: { ms: 'Selamat Menyambut Awal Muharram', en: 'Happy Islamic New Year', zh: '伊斯兰新年快乐', ta: 'இஸ்லாமிய புத்தாண்டு வாழ்த்துகள்' } },
  { id: 'maulid', rule: ['hijri', 3, 12], lead: 2, tail: 1, motifs: ['crescent', 'star'], c1: '#22c55e', c2: '#fde68a', c3: '#f8fafc', calm: true,
    name: { ms: 'Maulidur Rasul', en: 'Maulidur Rasul', zh: '圣纪节', ta: 'மௌலிதுர் ரசூல்' }, hi: { ms: 'Selamat Menyambut Maulidur Rasul', en: 'Selamat Menyambut Maulidur Rasul', zh: '圣纪节平安', ta: 'மௌலிதுர் ரசூல் வாழ்த்துகள்' } },
  { id: 'deepavali', rule: ['table', { 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26', 2031: '11-14', 2032: '11-02', 2033: '10-22' }, 'newmoon-oct'], lead: 14, tail: 3, motifs: ['diya', 'marigold', 'rangoli'], c1: '#ff8f1f', c2: '#ffd166', c3: '#d6249f',
    name: { ms: 'Deepavali', en: 'Deepavali', zh: '屠妖节', ta: 'தீபாவளி' }, hi: { ms: 'Selamat Deepavali', en: 'Happy Deepavali', zh: '屠妖节快乐', ta: 'இனிய தீபாவளி நல்வாழ்த்துகள்' } },
  { id: 'thaipusam', rule: ['moon', 'full', '01-14', '02-12', { 2026: '02-01', 2027: '01-22', 2028: '01-12' }], lead: 7, tail: 1, motifs: ['marigold', 'vel', 'sparkle'], c1: '#f59e0b', c2: '#fde047', c3: '#dc2626',
    name: { ms: 'Thaipusam', en: 'Thaipusam', zh: '大宝森节', ta: 'தைப்பூசம்' }, hi: { ms: 'Selamat Hari Thaipusam', en: 'Happy Thaipusam', zh: '大宝森节快乐', ta: 'தைப்பூச வாழ்த்துகள்' } },
  { id: 'wesak', rule: ['moon', 'full', '05-05', '06-03', { 2026: '05-31', 2027: '05-20', 2028: '05-09' }], lead: 7, tail: 1, motifs: ['lotus', 'lantern', 'star'], c1: '#f472b6', c2: '#fde68a', c3: '#f59e0b', calm: true,
    name: { ms: 'Hari Wesak', en: 'Wesak Day', zh: '卫塞节', ta: 'வெசாக்' }, hi: { ms: 'Selamat Hari Wesak', en: 'Happy Wesak Day', zh: '卫塞节快乐', ta: 'வெசாக் வாழ்த்துகள்' } },
  { id: 'kaamatan', rule: ['fixed', '05-30'], lead: 5, tail: 2, motifs: ['paddy', 'sparkle', 'coin'], c1: '#eab308', c2: '#fde047', c3: '#b91c1c',
    name: { ms: 'Pesta Kaamatan', en: 'Kaamatan Harvest Festival', zh: '丰收节 (沙巴)', ta: 'கமாத்தான் அறுவடை விழா' }, hi: { ms: 'Kotobian Tadau Tagazo Kaamatan', en: 'Kotobian Tadau Tagazo Kaamatan', zh: '丰收节快乐', ta: 'கமாத்தான் வாழ்த்துகள்' } },
  { id: 'gawai', rule: ['fixed', '06-01'], lead: 5, tail: 2, motifs: ['paddy', 'sparkle', 'coin'], c1: '#dc2626', c2: '#facc15', c3: '#f8fafc',
    name: { ms: 'Hari Gawai', en: 'Gawai Dayak', zh: '加瓦节 (砂拉越)', ta: 'காவாய் தயாக்' }, hi: { ms: 'Gayu Guru, Gerai Nyamai', en: 'Gayu Guru, Gerai Nyamai', zh: '加瓦节快乐', ta: 'காவாய் வாழ்த்துகள்' } },
  { id: 'merdeka', rule: ['fixed', '08-31'], lead: 14, tail: 1, motifs: ['star14', 'hibiscus', 'confetti'], c1: '#e11d2e', c2: '#ffd100', c3: '#3b5bdb',
    name: { ms: 'Hari Merdeka', en: 'Merdeka Day', zh: '独立日', ta: 'மெர்டேக்கா தினம்' }, hi: { ms: 'Selamat Hari Merdeka', en: 'Happy Merdeka Day', zh: '独立日快乐', ta: 'மெர்டேக்கா தின வாழ்த்துகள்' } },
  { id: 'malaysiaday', rule: ['fixed', '09-16'], lead: 7, tail: 1, motifs: ['star14', 'hibiscus', 'confetti'], c1: '#e11d2e', c2: '#ffd100', c3: '#3b5bdb',
    name: { ms: 'Hari Malaysia', en: 'Malaysia Day', zh: '马来西亚日', ta: 'மலேசிய தினம்' }, hi: { ms: 'Selamat Hari Malaysia', en: 'Happy Malaysia Day', zh: '马来西亚日快乐', ta: 'மலேசிய தின வாழ்த்துகள்' } },
  { id: 'midautumn', rule: ['chinese', 8, 15], lead: 7, tail: 1, motifs: ['lantern', 'moon', 'sparkle'], c1: '#f59e0b', c2: '#fde68a', c3: '#e11d2e',
    name: { ms: 'Pesta Kuih Bulan', en: 'Mid-Autumn Festival', zh: '中秋节', ta: 'இலையுதிர் கால விழா' }, hi: { ms: 'Selamat Pesta Kuih Bulan', en: 'Happy Mid-Autumn Festival', zh: '中秋节快乐', ta: 'நிலவு விழா வாழ்த்துகள்' } },
  { id: 'christmas', rule: ['fixed', '12-25'], lead: 21, tail: 1, motifs: ['snow', 'star', 'bauble'], c1: '#dc2626', c2: '#22c55e', c3: '#fde68a',
    name: { ms: 'Krismas', en: 'Christmas', zh: '圣诞节', ta: 'கிறிஸ்துமஸ்' }, hi: { ms: 'Selamat Hari Krismas', en: 'Merry Christmas', zh: '圣诞快乐', ta: 'கிறிஸ்துமஸ் வாழ்த்துகள்' } },
];
export const byId = Object.fromEntries(FESTIVALS.map((f) => [f.id, f]));

const MS = 86400000, SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14); // a known new moon
const pad = (n) => String(n).padStart(2, '0');
export const key = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
/** Midnight-UTC Date for the viewer's local calendar day (festival days are calendar dates). */
export const dayOf = (d = new Date()) => utc(d.getFullYear(), d.getMonth() + 1, d.getDate());
export const addDays = (d, n) => new Date(d.getTime() + n * MS);

const fmtCache = {};
function cal(name, date) { // calendar parts of the Gregorian day, read at noon Malaysia time
  const f = fmtCache[name] || (fmtCache[name] = new Intl.DateTimeFormat('en-u-ca-' + name + '-nu-latn', { day: 'numeric', month: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }));
  const o = {}; for (const p of f.formatToParts(new Date(date.getTime() + 4 * 3600000))) o[p.type] = parseInt(p.value, 10);
  return o;
}
function viaCalendar(name, month, day, year) {
  const out = [];
  try {
    for (let i = 0; i < 366; i++) { const g = addDays(utc(year, 1, 1), i); if (g.getUTCFullYear() !== year) break; const c = cal(name, g); if (c.month === month && c.day === day) out.push(g); }
  } catch (e) { /* calendar not supported on this device */ }
  return out;
}
const CNY = { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11' }; // exact, by announcement
function moonDates(year, kind) { // approximate full/new moon calendar days (+-1)
  const half = kind === 'full' ? SYN / 2 : 0, out = [];
  const k0 = Math.floor((utc(year, 1, 1).getTime() - NEW0) / (SYN * MS)) - 1;
  for (let k = k0; k < k0 + 15; k++) { const t = NEW0 + (k * SYN + half) * MS + 8 * 3600000; out.push(new Date(Math.floor(t / MS) * MS)); } // Malaysia time
  return out;
}
/** Calendar days (midnight UTC Dates) on which the festival falls in the Gregorian `year`. */
export function datesIn(f, year) {
  const [t, a, b, c, tab] = f.rule;
  if (t === 'fixed') { const [m, d] = a.split('-').map(Number); return [utc(year, m, d)]; }
  if (t === 'table') { if (a[year]) { const [m, d] = a[year].split('-').map(Number); return [utc(year, m, d)]; } return moonDates(year, 'new').filter((d) => d.getUTCFullYear() === year && d.getUTCMonth() >= 9).map((d) => addDays(d, -1)).slice(0, 1); }
  if (t === 'chinese') { if (f.id === 'cny' && CNY[year]) { const [m, d] = CNY[year].split('-').map(Number); return [utc(year, m, d)]; } return viaCalendar('chinese', a, b, year); }
  if (t === 'hijri') return viaCalendar('islamic-umalqura', a, b, year);
  if (t === 'moon') { if (tab && tab[year]) { const [m, d] = tab[year].split('-').map(Number); return [utc(year, m, d)]; } const lo = utc(year, ...b.split('-').map(Number)), hi = utc(year, ...c.split('-').map(Number)); return moonDates(year, a).filter((d) => d >= lo && d <= hi).slice(-1); }
  return [];
}

/**
 * Which festival (if any) is "on" today. Returns { f, day, phase: 'lead'|'day'|'after', daysTo } or null.
 * When windows overlap the one whose day is nearest wins; calm festivals (Ramadan...) yield to livelier ones.
 */
export function activeFestival(now = new Date(), list = FESTIVALS) {
  const today = dayOf(now), y = today.getUTCFullYear(), hits = [];
  for (const f of list) for (const yr of [y - 1, y, y + 1]) for (const day of datesIn(f, yr)) {
    const daysTo = Math.round((day - today) / MS);
    if (daysTo <= f.lead && daysTo >= -f.tail) hits.push({ f, day, daysTo, phase: daysTo > 0 ? 'lead' : daysTo === 0 ? 'day' : 'after' });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => (a.f.calm === b.f.calm ? Math.abs(a.daysTo) - Math.abs(b.daysTo) : a.f.calm ? 1 : -1));
  return hits[0];
}

/** Next upcoming festivals from today (for the picker): [{f, day, daysTo}] sorted. */
export function upcoming(now = new Date(), n = 6) {
  const today = dayOf(now), y = today.getUTCFullYear(), out = [];
  for (const f of FESTIVALS) for (const yr of [y, y + 1]) for (const day of datesIn(f, yr)) { const daysTo = Math.round((day - today) / MS); if (daysTo >= 0) out.push({ f, day, daysTo }); }
  const seen = new Set(), uniq = [];
  out.sort((a, b) => a.daysTo - b.daysTo).forEach((o) => { if (!seen.has(o.f.id)) { seen.add(o.f.id); uniq.push(o); } });
  return uniq.slice(0, n);
}
export const HEX = /^#[0-9a-f]{6}$/i;
