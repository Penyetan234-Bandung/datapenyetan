import * as db from '../db.js';
import { icon, emptyState } from '../util.js';
import { MONTHS, rupiah, todayStr, monthRange, summarize, incomeEntries, expenseEntries, weeklyDays, weekOfMonth, inRange } from '../calc.js';
import { barChart } from '../charts.js';

const now = new Date();
const state = { y: now.getFullYear(), m: now.getMonth() + 1, week: weekOfMonth(now.getDate()) };

export default async function (el) {
  const [orders, expenses] = await Promise.all([db.getAll('orders'), db.getAll('expenses')]);

  function draw() {
    const { from, to } = monthRange(state.y, state.m);
    const s = summarize(orders, expenses, from, to);
    const inc = incomeEntries(orders);
    const exp = expenseEntries(expenses);
    const hasData = orders.some((o) => inRange(o.date, from, to)) || expenses.some((e) => inRange(e.date, from, to)) || inc.some((e) => inRange(e.date, from, to));
    const years = [];
    for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 1; y++) years.push(y);

    el.innerHTML = `
      <div class="month-pick">
        <select id="m" aria-label="Bulan">${MONTHS.map((n, i) => `<option value="${i + 1}" ${i + 1 === state.m ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <select id="y" aria-label="Tahun">${years.map((y) => `<option ${y === state.y ? 'selected' : ''}>${y}</option>`).join('')}</select>
      </div>
      <div class="stat in"><div class="lbl">Penjualan (Bulan Ini)</div><div class="val">${rupiah(s.omzet)}</div><div class="sub">Uang masuk ${rupiah(s.received)} · belum dibayar ${rupiah(s.unpaid)}</div></div>
      <div class="stat out"><div class="lbl">Belanja (Bulan Ini)</div><div class="val">${rupiah(s.spend)}</div></div>
      <div class="stat act"><div class="lbl">Pesanan Aktif (Belum Difakturkan)</div><div class="val">${s.activeCount} Pesanan</div><div class="sub">${rupiah(s.activeValue)}</div></div>
      ${hasData ? '' : emptyState('Belum ada transaksi bulan ini', 'Mulai dengan menambah pesanan atau belanja. Angka dan grafik terisi otomatis.')}
      <h2 class="section-title">Pintasan</h2>
      <div class="shortcuts">
        ${[['pesanan', 'Pesanan', 'orders'], ['lembur', 'Lembur', 'clock'], ['reservasi', 'Reservasi', 'calendar'], ['pelanggan', 'Pelanggan', 'users'], ['belanja', 'Belanja', 'cart']]
          .map(([k, l, i]) => `<a class="sc" href="#/${k}">${icon(i, 24)}<span>${l}</span></a>`).join('')}
      </div>
      <h2 class="section-title">Grafik Mingguan</h2>
      <div class="chips" role="tablist">${[1, 2, 3, 4].map((w) => `<button class="chip ${w === state.week ? 'on' : ''}" data-w="${w}" role="tab">M${w}</button>`).join('')}</div>
      <div class="card"><h3 style="font-size:15px;margin-bottom:6px">Penjualan (Uang Masuk)</h3>${barChart(weeklyDays(inc, state.y, state.m, state.week), '#10B981')}</div>
      <div class="card"><h3 style="font-size:15px;margin-bottom:6px">Belanja (Uang Keluar)</h3>${barChart(weeklyDays(exp, state.y, state.m, state.week), '#F43F5E')}</div>
      <p class="muted small">M1 = tanggal 1–7, M2 = 8–14, M3 = 15–21, M4 = 22–akhir bulan. Penjualan = pesanan selesai/difakturkan; uang masuk dicatat pada tanggal DP dan tanggal pelunasan.</p>`;
  }

  el.onchange = (e) => {
    if (e.target.id === 'm') state.m = Number(e.target.value);
    if (e.target.id === 'y') state.y = Number(e.target.value);
    draw();
  };
  el.onclick = (e) => {
    const c = e.target.closest('[data-w]');
    if (c) { state.week = Number(c.dataset.w); draw(); }
  };
  draw();
}
