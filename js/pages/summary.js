import * as db from '../db.js';
import { esc, rupiah, fmtDate, emptyState, downloadCSV } from '../util.js';
import { periodRange, summarize, groupSales, topMenus, topCustomers, incomeEntries, expenseEntries, incomeExpenseSeries, monthLabel, toCSV, todayStr } from '../calc.js';
import { groupedChart } from '../charts.js';

const st = { period: 'bulan', from: '', to: '', mode: 'day' };

export default async function (el) {
  const [orders, expenses] = await Promise.all([db.getAll('orders'), db.getAll('expenses')]);

  const label = (key) => (st.mode === 'month' ? monthLabel(key) : st.mode === 'week' ? 'Mgg ' + fmtDate(key) : fmtDate(key));

  function draw() {
    const { from, to } = periodRange(st.period, st.from, st.to);
    const s = summarize(orders, expenses, from, to);
    const rec = groupSales(orders, st.mode, from, to);
    const menus = topMenus(orders, from, to);
    const custs = topCustomers(orders, from, to);
    const series = incomeExpenseSeries(incomeEntries(orders), expenseEntries(expenses), from, to);
    const empty = !orders.length && !expenses.length;

    el.innerHTML = `
      <div class="page-head"><h1>Rangkuman</h1><div class="head-actions"><button class="btn small" data-action="csv">Ekspor CSV</button></div></div>
      <div class="filters">
        <select id="period" class="wide" aria-label="Periode"><option value="bulan">Bulan ini</option><option value="lalu">Bulan lalu</option><option value="7hari">7 hari terakhir</option><option value="tahun">Tahun ini</option><option value="semua">Semua waktu</option><option value="rentang">Pilih tanggal…</option></select>
        ${st.period === 'rentang' ? `<input type="date" id="from" value="${st.from}" aria-label="Dari"><input type="date" id="to" value="${st.to}" aria-label="Sampai">` : ''}
      </div>
      ${empty ? emptyState('Belum ada data', 'Laporan terisi otomatis dari pesanan dan belanja yang Anda catat.') : ''}
      <div class="stat-grid">
        <div class="stat plain"><div class="lbl">Jumlah pesanan</div><div class="val">${s.orderCount}</div></div>
        <div class="stat plain"><div class="lbl">Nilai pesanan</div><div class="val">${rupiah(s.orderValue)}</div></div>
        <div class="stat in"><div class="lbl">Omzet penjualan</div><div class="val">${rupiah(s.omzet)}</div></div>
        <div class="stat in"><div class="lbl">Uang masuk (termasuk DP)</div><div class="val">${rupiah(s.received)}</div></div>
        <div class="stat act"><div class="lbl">Tagihan belum dibayar</div><div class="val">${rupiah(s.unpaid)}</div></div>
        <div class="stat out"><div class="lbl">Total belanja</div><div class="val">${rupiah(s.spend)}</div></div>
      </div>
      <div class="card" style="margin-top:10px"><div class="row between"><b>Uang masuk − belanja</b><b style="color:${s.cashDiff < 0 ? 'var(--del)' : 'var(--g-dark)'}">${rupiah(s.cashDiff)}</b></div>
        <div class="note" style="margin-bottom:0">Ini selisih kas sederhana, <b>bukan laba</b>. Laba bersih belum bisa dihitung karena HPP, gaji, sewa, dan biaya lain belum tercatat lengkap.</div></div>
      <div class="muted small" style="margin-top:8px"><b>Nilai pesanan</b> = semua pesanan. <b>Omzet</b> = pesanan selesai/difakturkan. <b>Uang masuk</b> = pembayaran yang diterima, yaitu DP (pada tanggal DP) dan pelunasan (pada tanggal bayar). <b>Tagihan belum dibayar</b> = sisa setelah DP. Pesanan aktif belum difakturkan belum masuk omzet.</div>

      <h2 class="section-title">Grafik Pemasukan &amp; Pengeluaran</h2>
      <div class="card">${groupedChart(series.rows)}</div>

      <h2 class="section-title">Rekap Penjualan</h2>
      <div class="chips"><button class="chip ${st.mode === 'day' ? 'on' : ''}" data-mode="day">Harian</button><button class="chip ${st.mode === 'week' ? 'on' : ''}" data-mode="week">Mingguan</button><button class="chip ${st.mode === 'month' ? 'on' : ''}" data-mode="month">Bulanan</button></div>
      <div class="card">${rec.length ? `<table class="report-table"><thead><tr><th>${st.mode === 'day' ? 'Tanggal' : st.mode === 'week' ? 'Minggu mulai' : 'Bulan'}</th><th class="r">Pesanan</th><th class="r">Omzet</th><th class="r">Uang masuk</th></tr></thead><tbody>
        ${rec.map((r) => `<tr><td>${esc(label(r.key))}</td><td class="r">${r.count}</td><td class="r">${rupiah(r.omzet)}</td><td class="r">${rupiah(r.received)}</td></tr>`).join('')}</tbody></table>` : '<div class="chart-empty">Belum ada penjualan pada periode ini</div>'}</div>

      <h2 class="section-title">Menu Terlaris</h2>
      <div class="card">${menus.length ? menus.map((m, i) => `<div class="rank"><span class="n">${i + 1}</span><div class="grow"><b>${esc(m.name)}</b><div class="muted small">${m.qty} terjual</div></div><b>${rupiah(m.revenue)}</b></div>`).join('') : '<div class="chart-empty">Belum ada data</div>'}</div>

      <h2 class="section-title">Pelanggan Transaksi Tertinggi</h2>
      <div class="card">${custs.length ? custs.map((c, i) => `<div class="rank"><span class="n">${i + 1}</span><div class="grow"><b>${esc(c.name)}</b><div class="muted small">${c.count} pesanan</div></div><b>${rupiah(c.total)}</b></div>`).join('') : '<div class="chart-empty">Belum ada data</div>'}</div>`;
    el.querySelector('#period').value = st.period;
  }

  el.onchange = (e) => {
    const id = e.target.id;
    if (id === 'period') { st.period = e.target.value; draw(); }
    else if (id === 'from' || id === 'to') { st[id] = e.target.value; draw(); }
  };
  el.onclick = (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { st.mode = m.dataset.mode; return draw(); }
    if (e.target.closest('[data-action="csv"]')) {
      const { from, to } = periodRange(st.period, st.from, st.to);
      const s = summarize(orders, expenses, from, to);
      const rows = [['Rangkuman Penyetan 234'], ['Periode', from || 'awal', to || 'sekarang'], [],
        ['Jumlah pesanan', s.orderCount], ['Nilai pesanan', s.orderValue], ['Omzet penjualan', s.omzet], ['Uang masuk', s.received],
        ['Tagihan belum dibayar', s.unpaid], ['Total belanja', s.spend], ['Selisih kas sederhana (bukan laba)', s.cashDiff], [],
        ['Rekap', 'Pesanan', 'Omzet', 'Uang masuk'], ...groupSales(orders, st.mode, from, to).map((r) => [r.key, r.count, r.omzet, r.received])];
      downloadCSV(`rangkuman-penyetan234-${todayStr()}.csv`, toCSV(rows));
    }
  };
  draw();
}
