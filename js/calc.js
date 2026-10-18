// Fungsi murni (tanpa DOM) untuk perhitungan, format, dan CSV. Dapat diuji di Node.

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (n) => String(n).padStart(2, '0');
export const sum = (arr) => arr.reduce((s, n) => s + (Number(n) || 0), 0);

/* ---------- Format ---------- */
export function rupiah(n) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-Rp ' : 'Rp ') + s;
}

export function compact(n) {
  const v = Math.round(Number(n) || 0);
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + 'jt';
  if (v >= 1e3) return Math.round(v / 1e3) + 'rb';
  return String(v);
}

export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDate(s) {
  if (!s) return '-';
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/* ---------- Tanggal ---------- */
export function monthRange(y, m) {
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

export function inRange(d, from, to) {
  if (!d) return false;
  return (!from || d >= from) && (!to || d <= to);
}

export function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

export function weekStart(s) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function weekOfMonth(day) {
  return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
}

export function periodRange(preset, from = '', to = '', now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  switch (preset) {
    case 'bulan': return monthRange(y, m);
    case 'lalu': { const d = new Date(y, m - 2, 1); return monthRange(d.getFullYear(), d.getMonth() + 1); }
    case '7hari': return { from: addDays(todayStr(now), -6), to: todayStr(now) };
    case 'tahun': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'rentang': return { from, to };
    default: return { from: '', to: '' };
  }
}

/* ---------- Pesanan ---------- */
export const orderTotal = (items) => (items || []).reduce((s, i) => s + Math.round((Number(i.qty) || 0) * (Number(i.price) || 0)), 0);
export const expenseTotal = (qty, price) => Math.round((Number(qty) || 0) * (Number(price) || 0));

// Aktif = belum selesai dan belum difakturkan.
export const isActive = (o) => o.status !== 'selesai' && !o.invoice;
// Masuk omzet = sudah selesai atau sudah difakturkan.
export const isBillable = (o) => o.status === 'selesai' || !!o.invoice;

export function summarize(orders, expenses, from, to) {
  const inPeriod = orders.filter((o) => inRange(o.date, from, to));
  const billable = inPeriod.filter(isBillable);
  const active = orders.filter(isActive); // pesanan aktif dihitung seluruhnya, tidak terikat bulan
  const received = sum(orders.flatMap((o) => paymentEntries(o)).filter((p) => inRange(p.date, from, to)).map((p) => p.amount));
  const spend = sum(expenses.filter((e) => inRange(e.date, from, to)).map((e) => e.total));
  return {
    orderCount: inPeriod.length,
    orderValue: sum(inPeriod.map((o) => o.total)),
    omzet: sum(billable.map((o) => o.total)),
    received,
    unpaid: sum(billable.filter((o) => !o.paid).map(outstanding)),
    spend,
    activeCount: active.length,
    activeValue: sum(active.map((o) => o.total)),
    cashDiff: received - spend,
  };
}

export const incomeEntries = (orders) => orders.flatMap((o) => paymentEntries(o));
export const expenseEntries = (expenses) => expenses.map((e) => ({ date: e.date, amount: e.total }));

export function weekRange(week) {
  return week === 1 ? [1, 7] : week === 2 ? [8, 14] : week === 3 ? [15, 21] : [22, 31];
}

export function weeklyDays(entries, y, m, week) {
  const last = new Date(y, m, 0).getDate();
  const [a, b0] = weekRange(week);
  const b = Math.min(b0, last);
  const out = [];
  for (let d = a; d <= b; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    out.push({ label: String(d), value: sum(entries.filter((e) => e.date === key).map((e) => e.amount)) });
  }
  return out;
}

export function groupSales(orders, mode, from, to) {
  const keyOf = (d) => (mode === 'day' ? d : mode === 'week' ? weekStart(d) : d.slice(0, 7));
  const map = new Map();
  const row = (k) => {
    if (!map.has(k)) map.set(k, { key: k, count: 0, omzet: 0, received: 0 });
    return map.get(k);
  };
  for (const o of orders) {
    if (isBillable(o) && inRange(o.date, from, to)) {
      const r = row(keyOf(o.date));
      r.count++;
      r.omzet += o.total;
    }
    for (const p of paymentEntries(o)) if (inRange(p.date, from, to)) row(keyOf(p.date)).received += p.amount;
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function topMenus(orders, from, to, n = 5) {
  const map = new Map();
  for (const o of orders) {
    if (!isBillable(o) || !inRange(o.date, from, to)) continue;
    for (const i of o.items) {
      const k = i.name.trim().toLowerCase();
      const r = map.get(k) || { name: i.name, qty: 0, revenue: 0 };
      r.qty += Number(i.qty) || 0;
      r.revenue += Math.round((Number(i.qty) || 0) * (Number(i.price) || 0));
      map.set(k, r);
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, n);
}

export function topCustomers(orders, from, to, n = 5) {
  const map = new Map();
  for (const o of orders) {
    if (!isBillable(o) || !inRange(o.date, from, to)) continue;
    const k = o.customerId || o.customerName.trim().toLowerCase();
    const r = map.get(k) || { name: o.customerName, count: 0, total: 0 };
    r.count++;
    r.total += o.total;
    map.set(k, r);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export function ordersOfCustomer(c, orders) {
  const nm = c.name.trim().toLowerCase();
  return orders.filter((o) => o.customerId === c.id || (!o.customerId && o.customerName.trim().toLowerCase() === nm));
}

export function incomeExpenseSeries(inc, exp, from, to) {
  const all = [...inc, ...exp].map((e) => e.date).filter(Boolean).sort();
  if (!all.length) return { mode: 'day', rows: [] };
  const f = from || all[0];
  const t = to || all[all.length - 1];
  const sumOn = (arr, test) => sum(arr.filter((e) => test(e.date)).map((e) => e.amount));
  const rows = [];
  if (daysBetween(f, t) <= 30) {
    for (let d = f; d <= t; d = addDays(d, 1)) {
      rows.push({ key: d, label: String(Number(d.slice(8))), income: sumOn(inc, (x) => x === d), expense: sumOn(exp, (x) => x === d) });
    }
    return { mode: 'day', rows };
  }
  let [y, m] = f.slice(0, 7).split('-').map(Number);
  const endKey = t.slice(0, 7);
  for (;;) {
    const key = `${y}-${pad(m)}`;
    if (key > endKey) break;
    rows.push({
      key,
      label: `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`,
      income: sumOn(inc, (x) => inRange(x, f, t) && x.slice(0, 7) === key),
      expense: sumOn(exp, (x) => inRange(x, f, t) && x.slice(0, 7) === key),
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return { mode: 'month', rows };
}

/* ---------- CSV ---------- */
export function toCSV(rows) {
  const cell = (v) => {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah formula injection di Excel
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return d;
}

/* ---------- Lembur ---------- */
const toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN; };
// Menit lembur; jika jam selesai <= jam mulai dianggap melewati tengah malam.
export function overtimeMinutes(start, end) {
  const a = toMin(start), b = toMin(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return 0;
  return b > a ? b - a : b + 1440 - a;
}
export function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h && m ? `${h} jam ${m} menit` : h ? `${h} jam` : `${m} menit`;
}
export const overtimePay = (min, rate) => Math.round((min / 60) * (Number(rate) || 0));

/* ---------- Diskon, pajak, DP ---------- */
// Urutan: subtotal - diskon = dasar pajak; + pajak = total; total - DP = sisa tagihan.
export function orderBreakdown(subtotal, { discountType = 'rp', discountValue = 0, taxRate = 0, dp = 0 } = {}) {
  const sub = Math.round(Number(subtotal) || 0);
  const dv = Math.max(0, Number(discountValue) || 0);
  const discount = discountType === 'pct' ? Math.round((sub * Math.min(dv, 100)) / 100) : Math.min(Math.round(dv), sub);
  const base = sub - discount;
  const rate = Math.min(Math.max(Number(taxRate) || 0, 0), 100);
  const tax = Math.round((base * rate) / 100);
  const total = base + tax;
  const d = Math.max(0, Math.round(Number(dp) || 0));
  return { subtotal: sub, discount, base, tax, total, dp: d, remaining: total - d };
}

// Sisa tagihan pesanan yang belum lunas (total dikurangi DP).
export const outstanding = (o) => Math.max(0, (Number(o.total) || 0) - (Number(o.dp) || 0));

// Pembayaran yang benar-benar diterima: DP pada tanggal DP, sisanya pada tanggal pelunasan.
export function paymentEntries(o) {
  const dp = Math.min(Number(o.dp) || 0, Number(o.total) || 0);
  const out = [];
  if (dp > 0) out.push({ date: o.dpDate || o.date, amount: dp });
  if (o.paid && o.total - dp > 0) out.push({ date: o.paidDate || o.date, amount: o.total - dp });
  return out;
}
