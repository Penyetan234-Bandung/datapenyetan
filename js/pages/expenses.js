import * as db from '../db.js';
import { esc, rupiah, fmtDate, todayStr, icon, emptyState, fab, openSheet, confirmDialog, toast, formData, options, downloadCSV, pageHeader } from '../util.js';
import { inRange, periodRange, expenseTotal, sum, toCSV } from '../calc.js';

const st = { q: '', period: 'bulan', from: '', to: '' };

export default async function (el) {
  let list = [];
  let profile;

  async function load() {
    [list, profile] = await Promise.all([db.getAll('expenses'), db.getProfile()]);
  }

  function filtered() {
    const r = periodRange(st.period, st.from, st.to);
    const q = st.q.toLowerCase();
    return list
      .filter((e) => inRange(e.date, r.from, r.to))
      .filter((e) => !q || [e.name, e.category, e.supplier, e.note].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  }

  function listHTML() {
    const f = filtered();
    const head = `<div class="stat out"><div class="lbl">Total belanja (${f.length} transaksi)</div><div class="val">${rupiah(sum(f.map((e) => e.total)))}</div></div>`;
    if (!f.length) return head + (list.length ? emptyState('Tidak ada belanja', 'Tidak ada data pada filter ini.') : emptyState('Belum ada belanja', 'Ketuk tombol + untuk mencatat pengeluaran operasional.'));
    return head + f.map((e) => `
      <div class="card">
        <div class="row between"><b style="font-size:16px">${esc(e.name)}</b><b>${rupiah(e.total)}</b></div>
        <div class="muted small">${fmtDate(e.date)} · ${e.qty} × ${rupiah(e.price)}${e.supplier ? ' · ' + esc(e.supplier) : ''}</div>
        <div class="row between" style="margin-top:8px"><div class="badges">${e.category ? `<span class="badge bad">${esc(e.category)}</span>` : ''}${e.note ? `<span class="muted small">${esc(e.note)}</span>` : ''}</div>
          <div class="btn-pair"><button class="btn small edit" data-action="edit" data-id="${e.id}">Edit</button><button class="btn small danger" data-action="del" data-id="${e.id}">Hapus</button></div></div>
      </div>`).join('');
  }

  function draw() {
    el.innerHTML = `
      ${pageHeader('Belanja', { back: '#/lainnya', actions: '<button class="btn small" data-action="csv">Ekspor CSV</button>' })}
      <div class="search">${icon('search', 20)}<input type="search" id="q" placeholder="Cari barang, kategori, pemasok" value="${esc(st.q)}" autocomplete="off"></div>
      <div class="filters">
        <select id="period" class="wide" aria-label="Periode"><option value="bulan">Bulan ini</option><option value="lalu">Bulan lalu</option><option value="semua">Semua waktu</option><option value="rentang">Pilih tanggal…</option></select>
        ${st.period === 'rentang' ? `<input type="date" id="from" value="${st.from}" aria-label="Dari"><input type="date" id="to" value="${st.to}" aria-label="Sampai">` : ''}
      </div>
      <div id="list">${listHTML()}</div>${fab('Tambah belanja')}`;
    el.querySelector('#period').value = st.period;
  }
  const redraw = async () => { await load(); draw(); };

  function form(e0) {
    const isEdit = !!e0;
    const cats = [...new Set([...profile.expenseCategories, ...list.map((x) => x.category).filter(Boolean)])];
    const names = [...new Set(list.map((x) => x.name))];
    openSheet(isEdit ? 'Edit Belanja' : 'Tambah Belanja', `
      <form id="f" novalidate>
        <div class="two"><label class="field"><span>Tanggal *</span><input type="date" name="date" required value="${esc(e0?.date || todayStr())}"></label>
        <label class="field"><span>Kategori</span><input type="text" name="category" list="dl-ecat" maxlength="40" value="${esc(e0?.category || '')}"><datalist id="dl-ecat">${options(cats)}</datalist></label></div>
        <label class="field"><span>Nama barang *</span><input type="text" name="name" list="dl-ename" required maxlength="80" value="${esc(e0?.name)}" autocomplete="off"><datalist id="dl-ename">${options(names)}</datalist></label>
        <div class="two"><label class="field"><span>Jumlah *</span><input type="number" name="qty" inputmode="decimal" min="0" step="any" required value="${e0 ? e0.qty : 1}"></label>
        <label class="field"><span>Harga satuan (Rp) *</span><input type="number" name="price" inputmode="numeric" min="0" required value="${e0 ? e0.price : ''}"></label></div>
        <div class="total-line"><span>Total</span><span id="total">Rp 0</span></div>
        <label class="field"><span>Pemasok</span><input type="text" name="supplier" maxlength="80" value="${esc(e0?.supplier)}"></label>
        <label class="field"><span>Catatan</span><textarea name="note" maxlength="300">${esc(e0?.note)}</textarea></label>
        <button class="btn primary block" type="submit">Simpan</button>
      </form>`, {
      lock: true,
      onMount: (body, close) => {
        const f = body.querySelector('#f');
        const recalc = () => { body.querySelector('#total').textContent = rupiah(expenseTotal(f.qty.value, f.price.value)); };
        f.addEventListener('input', recalc);
        recalc();
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const d = formData(f);
          const qty = Number(d.qty), price = Number(d.price);
          if (!d.date) return toast('Tanggal wajib diisi', 'err');
          if (!d.name) return toast('Nama barang wajib diisi', 'err');
          if (!(qty > 0)) return toast('Jumlah harus lebih dari 0', 'err');
          if (d.price === '' || !(price >= 0)) return toast('Harga satuan tidak valid', 'err');
          await db.put('expenses', {
            id: e0?.id || db.uid(), date: d.date, name: d.name, category: d.category, qty, price: Math.round(price),
            total: expenseTotal(qty, price), supplier: d.supplier, note: d.note, createdAt: e0?.createdAt || Date.now(), updatedAt: Date.now(),
          });
          close();
          toast(isEdit ? 'Belanja diperbarui' : 'Belanja tersimpan');
          redraw();
        });
      },
    });
  }

  el.onclick = async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const x = list.find((i) => i.id === b.dataset.id);
    if (b.dataset.action === 'add') form(null);
    if (b.dataset.action === 'edit' && x) form(x);
    if (b.dataset.action === 'del' && x && (await confirmDialog(`Hapus belanja "${x.name}" (${rupiah(x.total)})?`))) {
      await db.del('expenses', x.id);
      toast('Belanja dihapus');
      redraw();
    }
    if (b.dataset.action === 'csv') {
      downloadCSV(`belanja-penyetan234-${todayStr()}.csv`, toCSV([['Tanggal', 'Nama Barang', 'Kategori', 'Jumlah', 'Harga Satuan', 'Total', 'Pemasok', 'Catatan'],
        ...filtered().map((r) => [r.date, r.name, r.category, r.qty, r.price, r.total, r.supplier, r.note])]));
    }
  };
  el.oninput = (e) => {
    if (e.target.id === 'q') { st.q = e.target.value; el.querySelector('#list').innerHTML = listHTML(); }
  };
  el.onchange = (e) => {
    const id = e.target.id;
    if (id === 'period') { st.period = e.target.value; draw(); }
    else if (id === 'from' || id === 'to') { st[id] = e.target.value; el.querySelector('#list').innerHTML = listHTML(); }
  };

  await load();
  draw();
}
