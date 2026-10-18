import assert from 'node:assert/strict';
import test from 'node:test';
import * as c from '../js/calc.js';

const O = (o) => ({ items: [], status: 'aktif', paid: false, invoice: null, customerName: 'A', ...o, total: o.total ?? c.orderTotal(o.items || []) });
const item = (name, qty, price) => ({ name, qty, price });

test('rupiah format', () => {
  assert.equal(c.rupiah(27000), 'Rp 27.000');
  assert.equal(c.rupiah(0), 'Rp 0');
  assert.equal(c.rupiah(1234567), 'Rp 1.234.567');
  assert.equal(c.rupiah(-5000), '-Rp 5.000');
});

test('orderTotal & expenseTotal', () => {
  assert.equal(c.orderTotal([item('a', 2, 27000), item('b', 3, 5000)]), 69000);
  assert.equal(c.orderTotal([item('a', 1.5, 10000)]), 15000);
  assert.equal(c.expenseTotal(2.5, 12000), 30000);
});

test('status pesanan terpisah dari pembayaran', () => {
  const selesai = O({ status: 'selesai', date: '2026-10-05', items: [item('a', 1, 10000)] });
  assert.equal(selesai.paid, false); // selesai tidak otomatis lunas
  assert.equal(c.isBillable(selesai), true);
  assert.equal(c.isActive(selesai), false);
  const aktif = O({ date: '2026-10-05', items: [item('a', 1, 10000)] });
  assert.equal(c.isActive(aktif), true);
  assert.equal(c.isBillable(aktif), false);
  const faktur = O({ date: '2026-10-05', invoice: { no: 'F-0001' }, items: [item('a', 1, 10000)] });
  assert.equal(c.isActive(faktur), false);
  assert.equal(c.isBillable(faktur), true);
});

const orders = [
  O({ id: '1', date: '2026-10-02', status: 'selesai', paid: true, paidDate: '2026-10-03', invoice: { no: 'F-1' }, items: [item('Ayam', 2, 27000)], customerId: 'c1', customerName: 'Budi' }),
  O({ id: '2', date: '2026-10-10', status: 'selesai', items: [item('Ayam', 1, 27000), item('Es Teh', 2, 5000)], customerId: 'c2', customerName: 'Sari' }),
  O({ id: '3', date: '2026-10-12', items: [item('Ayam', 3, 27000)], customerId: 'c1', customerName: 'Budi' }), // aktif
  O({ id: '4', date: '2026-09-28', status: 'selesai', paid: true, paidDate: '2026-10-01', invoice: { no: 'F-2' }, items: [item('Es Teh', 4, 5000)], customerId: 'c2', customerName: 'Sari' }),
];
const expenses = [
  { date: '2026-10-04', total: 100000 },
  { date: '2026-10-20', total: 50000 },
  { date: '2026-09-30', total: 70000 },
];

test('summarize Oktober', () => {
  const r = c.monthRange(2026, 10);
  assert.deepEqual(r, { from: '2026-10-01', to: '2026-10-31' });
  const s = c.summarize(orders, expenses, r.from, r.to);
  assert.equal(s.orderCount, 3);
  assert.equal(s.orderValue, 54000 + 37000 + 81000);
  assert.equal(s.omzet, 54000 + 37000); // pesanan aktif belum masuk omzet
  assert.equal(s.received, 54000 + 20000); // pesanan 4 dilunasi 1 Okt
  assert.equal(s.unpaid, 37000);
  assert.equal(s.spend, 150000); // tiap belanja dihitung sekali
  assert.equal(s.activeCount, 1);
  assert.equal(s.activeValue, 81000);
  assert.equal(s.cashDiff, 74000 - 150000);
});

test('summarize semua waktu', () => {
  const s = c.summarize(orders, expenses, '', '');
  assert.equal(s.spend, 220000);
  assert.equal(s.orderCount, 4);
});

test('grafik mingguan', () => {
  const inc = c.incomeEntries(orders);
  const w1 = c.weeklyDays(inc, 2026, 10, 1);
  assert.equal(w1.length, 7);
  assert.equal(w1[0].value, 20000); // 1 Okt
  assert.equal(w1[2].value, 54000); // 3 Okt
  assert.equal(c.weeklyDays(inc, 2026, 10, 4).length, 10); // 22-31
  assert.equal(c.weeklyDays(inc, 2026, 2, 4).length, 7); // Feb 2026: 22-28
  assert.equal(c.weekOfMonth(7), 1); assert.equal(c.weekOfMonth(8), 2); assert.equal(c.weekOfMonth(22), 4);
});

test('rekap & peringkat', () => {
  const day = c.groupSales(orders, 'day', '2026-10-01', '2026-10-31');
  assert.equal(day[0].key, '2026-10-10');
  const month = c.groupSales(orders, 'month', '', '');
  assert.equal(month.length, 2);
  const m = c.topMenus(orders, '', '');
  assert.equal(m[0].name, 'Es Teh'); // 2+4 = 6 terjual
  assert.equal(m[0].qty, 6);
  const t = c.topCustomers(orders, '', '');
  assert.equal(t[0].name, 'Sari'); // 37.000 + 20.000 = 57.000, Budi 54.000 (pesanan aktif tidak dihitung)
  assert.equal(t[0].total, 57000);
});

test('weekStart senin', () => {
  assert.equal(c.weekStart('2026-10-17'), '2026-10-12'); // Sabtu -> Senin
  assert.equal(c.weekStart('2026-10-12'), '2026-10-12');
  assert.equal(c.weekStart('2026-10-18'), '2026-10-12');
});

test('deret pemasukan/pengeluaran', () => {
  const full = c.incomeExpenseSeries(c.incomeEntries(orders), c.expenseEntries(expenses), '2026-10-01', '2026-10-31');
  assert.equal(full.mode, 'day'); // satu bulan penuh tetap harian
  assert.equal(full.rows.length, 31);
  const s = c.incomeExpenseSeries(c.incomeEntries(orders), c.expenseEntries(expenses), '2026-09-01', '2026-10-31');
  assert.equal(s.mode, 'month');
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[0].expense, 70000);
  assert.equal(s.rows[1].expense, 150000);
  assert.equal(s.rows[1].income, 74000);
  const d = c.incomeExpenseSeries(c.incomeEntries(orders), c.expenseEntries(expenses), '2026-10-01', '2026-10-07');
  assert.equal(d.mode, 'day');
  assert.equal(d.rows.length, 7);
  assert.equal(c.incomeExpenseSeries([], [], '', '').rows.length, 0);
});

test('CSV: kutip dan proteksi formula', () => {
  const out = c.toCSV([['a', 'b,c', 'd"e', '=1+1', 5], ['x\ny']]);
  assert.equal(out, 'a,"b,c","d""e",\'=1+1,5\r\n"x\ny"');
});

test('periodRange', () => {
  const now = new Date(2026, 9, 17);
  assert.deepEqual(c.periodRange('bulan', '', '', now), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(c.periodRange('lalu', '', '', now), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(c.periodRange('7hari', '', '', now), { from: '2026-10-11', to: '2026-10-17' });
  assert.deepEqual(c.periodRange('semua', '', '', now), { from: '', to: '' });
  const jan = new Date(2026, 0, 5);
  assert.deepEqual(c.periodRange('lalu', '', '', jan), { from: '2025-12-01', to: '2025-12-31' });
});

test('waNumber', () => {
  assert.equal(c.waNumber('0812-3456-789'), '628123456789');
  assert.equal(c.waNumber('+62 812 3456'), '628123456');
  assert.equal(c.waNumber(''), '');
});

test('lembur: durasi, lewat tengah malam, upah', () => {
  assert.equal(c.overtimeMinutes('17:00', '20:30'), 210);
  assert.equal(c.overtimeMinutes('22:00', '01:15'), 195);
  assert.equal(c.overtimeMinutes('08:00', '08:00'), 0);
  assert.equal(c.overtimeMinutes('', '10:00'), 0);
  assert.equal(c.fmtDuration(210), '3 jam 30 menit');
  assert.equal(c.fmtDuration(120), '2 jam');
  assert.equal(c.fmtDuration(45), '45 menit');
  assert.equal(c.overtimePay(210, 20000), 70000);
  assert.equal(c.overtimePay(90, 0), 0);
});

test('diskon, pajak, DP', () => {
  const b = c.orderBreakdown(50000, { discountType: 'pct', discountValue: 10, taxRate: 10, dp: 20000 });
  assert.deepEqual(b, { subtotal: 50000, discount: 5000, base: 45000, tax: 4500, total: 49500, dp: 20000, remaining: 29500 });
  const r = c.orderBreakdown(50000, { discountType: 'rp', discountValue: 7500 });
  assert.equal(r.total, 42500);
  assert.equal(c.orderBreakdown(10000, { discountType: 'rp', discountValue: 99999 }).total, 0); // diskon tidak melebihi subtotal
  assert.equal(c.orderBreakdown(10000, { discountType: 'pct', discountValue: 150 }).total, 0);
  assert.equal(c.orderBreakdown(33333, { taxRate: 11 }).tax, 3667); // pembulatan
  assert.equal(c.orderBreakdown(10000).total, 10000);
});

test('DP masuk uang masuk & sisa tagihan', () => {
  const o = { id: 'z', date: '2026-10-05', status: 'selesai', invoice: { no: 'F' }, items: [], total: 49500, dp: 20000, dpDate: '2026-10-05', paid: false, customerName: 'X' };
  assert.deepEqual(c.paymentEntries(o), [{ date: '2026-10-05', amount: 20000 }]);
  assert.equal(c.outstanding(o), 29500);
  const s = c.summarize([o], [], '2026-10-01', '2026-10-31');
  assert.equal(s.omzet, 49500); assert.equal(s.received, 20000); assert.equal(s.unpaid, 29500);
  const lunas = { ...o, paid: true, paidDate: '2026-10-20' };
  assert.deepEqual(c.paymentEntries(lunas), [{ date: '2026-10-05', amount: 20000 }, { date: '2026-10-20', amount: 29500 }]);
  const s2 = c.summarize([lunas], [], '2026-10-01', '2026-10-31');
  assert.equal(s2.received, 49500); assert.equal(s2.unpaid, 0); // tidak dihitung dua kali
  assert.deepEqual(c.paymentEntries({ total: 1000, date: '2026-10-01', paid: true, paidDate: '2026-10-02' }), [{ date: '2026-10-02', amount: 1000 }]); // pesanan lama
});
