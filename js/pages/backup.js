import * as db from '../db.js';
import { toast, confirmDialog, downloadText, downloadCSV, pageHeader, esc } from '../util.js';
import { todayStr, toCSV, ordersOfCustomer, isBillable, sum } from '../calc.js';

export default async function (el) {
  async function draw() {
    const counts = {};
    for (const s of db.STORES.filter((x) => x !== 'settings' && x !== 'attendance')) counts[s] = (await db.getAll(s)).length;
    let storage = '';
    if (navigator.storage?.estimate) {
      const { usage = 0 } = await navigator.storage.estimate();
      storage = `${(usage / 1024).toFixed(0)} KB terpakai`;
    }
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    el.innerHTML = `
      ${pageHeader('Ekspor & Pencadangan', { back: '#/lainnya' })}
      <div class="note">Data tersimpan <b>hanya di perangkat ini</b>. Jika HP hilang, rusak, atau data browser dihapus, data ikut hilang. Buat cadangan secara rutin dan simpan di tempat lain (Google Drive, WhatsApp ke diri sendiri, dll).</div>
      <div class="card"><b>Isi data saat ini</b><div class="muted small" style="margin-top:4px">${counts.orders} pesanan · ${counts.customers} pelanggan · ${counts.menus} menu · ${counts.expenses} belanja · ${counts.overtime} lembur · ${counts.reservations} reservasi${storage ? ' · ' + storage : ''}<br>Penyimpanan permanen: ${persisted ? 'aktif' : 'belum diberikan browser (data bisa dibersihkan saat ruang penuh)'}</div></div>
      <h2 class="section-title">Cadangan Lengkap (JSON)</h2>
      <div class="actions"><button class="btn primary" data-a="export">Unduh Cadangan</button><button class="btn" data-a="import">Pulihkan dari Cadangan</button></div>
      <input type="file" id="file" accept="application/json,.json" hidden>
      <h2 class="section-title">Ekspor CSV</h2>
      <div class="actions"><button class="btn" data-csv="orders">Pesanan</button><button class="btn" data-csv="expenses">Belanja</button><button class="btn" data-csv="customers">Pelanggan</button><button class="btn" data-csv="menus">Menu</button></div>
      <p class="muted small">CSV bisa dibuka di Excel / Google Sheets. Untuk laporan per periode, gunakan tombol Ekspor di halaman Pesanan, Belanja, dan Rangkuman.</p>`;
  }

  el.onclick = async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const csv = e.target.closest('[data-csv]')?.dataset.csv;
    if (a === 'export') {
      downloadText(`cadangan-penyetan234-${todayStr()}.json`, JSON.stringify(await db.exportAll()), 'application/json');
      toast('Cadangan diunduh');
    }
    if (a === 'import') el.querySelector('#file').click();
    if (csv === 'orders') {
      const o = await db.getAll('orders');
      downloadCSV(`pesanan-semua-${todayStr()}.csv`, toCSV([['No Pesanan', 'Tanggal', 'Pelanggan', 'Telepon', 'Menu', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'DP', 'Sisa Tagihan', 'Catatan', 'Status Pesanan', 'No Faktur', 'Status Pembayaran', 'Tanggal Bayar'],
        ...o.sort((x, y) => y.date.localeCompare(x.date)).map((r) => [r.no, r.date, r.customerName, r.phone, r.items.map((i) => `${i.qty}x ${i.name} @${i.price}`).join('; '), r.subtotal ?? r.total, r.discount || 0, r.tax || 0, r.total, r.dp || 0, r.paid ? 0 : r.total - (r.dp || 0), r.note, r.status === 'selesai' ? 'Selesai' : 'Aktif', r.invoice?.no || '', r.paid ? 'Lunas' : 'Belum lunas', r.paidDate || ''])]));
    }
    if (csv === 'expenses') {
      const x = await db.getAll('expenses');
      downloadCSV(`belanja-semua-${todayStr()}.csv`, toCSV([['Tanggal', 'Nama Barang', 'Kategori', 'Jumlah', 'Harga Satuan', 'Total', 'Pemasok', 'Catatan'], ...x.sort((p, q) => q.date.localeCompare(p.date)).map((r) => [r.date, r.name, r.category, r.qty, r.price, r.total, r.supplier, r.note])]));
    }
    if (csv === 'customers') {
      const [c, o] = await Promise.all([db.getAll('customers'), db.getAll('orders')]);
      downloadCSV('pelanggan-penyetan234.csv', toCSV([['Nama', 'Telepon', 'Alamat', 'Instansi', 'Catatan', 'Jumlah Pesanan', 'Total Transaksi'], ...c.map((r) => { const os = ordersOfCustomer(r, o); return [r.name, r.phone, r.address, r.company, r.note, os.length, sum(os.filter(isBillable).map((q) => q.total))]; })]));
    }
    if (csv === 'menus') {
      const m = await db.getAll('menus');
      downloadCSV('menu-penyetan234.csv', toCSV([['Nama', 'Kategori', 'Harga', 'Tersedia'], ...m.map((r) => [r.name, r.category, r.price, r.available === false ? 'Tidak' : 'Ya'])]));
    }
  };

  el.onchange = async (e) => {
    if (e.target.id !== 'file' || !e.target.files[0]) return;
    const file = e.target.files[0];
    e.target.value = '';
    let data;
    try { data = JSON.parse(await file.text()); } catch { return toast('Berkas bukan JSON yang valid', 'err'); }
    if (data?.app !== 'penyetan234') return toast('Berkas bukan cadangan Penyetan 234', 'err');
    const n = data.stores?.orders?.length || 0;
    if (!(await confirmDialog(`Pulihkan cadangan tanggal ${esc((data.exportedAt || '').slice(0, 10))} (${n} pesanan)? SEMUA data saat ini akan diganti. Disarankan unduh cadangan data saat ini dulu.`, { okText: 'Pulihkan', danger: true, title: 'Pulihkan data' }))) return;
    try {
      await db.importAll(data);
      toast('Data berhasil dipulihkan');
      draw();
    } catch (err) {
      toast(err.message || 'Gagal memulihkan data', 'err');
    }
  };
  await draw();
}
