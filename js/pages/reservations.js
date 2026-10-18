import * as db from '../db.js';
import { esc, fmtDate, todayStr, emptyState, fab, openSheet, confirmDialog, toast, formData, options, downloadCSV, pageHeader } from '../util.js';
import { toCSV, waNumber } from '../calc.js';

const STATUS = ['Menunggu', 'Dikonfirmasi', 'Selesai', 'Batal'];
const st = { date: '', status: '' };
const badge = (s) => (s === 'Dikonfirmasi' ? 'act' : s === 'Selesai' ? 'ok' : s === 'Batal' ? 'bad' : 'warn');

export default async function (el) {
  let list = [];
  const load = async () => { list = await db.getAll('reservations'); };
  const filtered = () => list
    .filter((r) => (!st.date || r.date === st.date) && (!st.status || r.status === st.status))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  function listHTML() {
    const f = filtered();
    if (!f.length) return list.length ? emptyState('Tidak ada reservasi', 'Tidak ada data pada filter ini.') : emptyState('Belum ada reservasi', 'Ketuk tombol + untuk mencatat reservasi.');
    return f.map((r) => `
      <div class="card"><div class="row between"><b style="font-size:16px">${esc(r.name)}</b><span class="badge ${badge(r.status)}">${r.status}</span></div>
        <div class="muted small">${fmtDate(r.date)}${r.time ? ' · ' + esc(r.time) : ''} · ${r.pax} orang${r.phone ? ' · ' + esc(r.phone) : ''}</div>
        ${r.note ? `<div class="small" style="margin-top:4px">${esc(r.note)}</div>` : ''}
        <div class="actions" style="margin-top:10px">
          <select data-action="status" data-id="${r.id}" aria-label="Ubah status" style="flex:1">${options(STATUS, r.status)}</select>
          ${waNumber(r.phone) ? `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${waNumber(r.phone)}">WA</a>` : ''}
          <button class="btn small edit" data-action="edit" data-id="${r.id}">Edit</button><button class="btn small danger" data-action="del" data-id="${r.id}">Hapus</button></div></div>`).join('');
  }

  function draw() {
    el.innerHTML = `
      ${pageHeader('Reservasi', { back: '#/lainnya', actions: '<button class="btn small" data-action="csv">Ekspor CSV</button>' })}
      <div class="filters"><input type="date" id="date" value="${st.date}" aria-label="Pilih tanggal">
        <select id="status" aria-label="Status"><option value="">Semua status</option>${options(STATUS, st.status)}</select>
        ${st.date ? '<button class="btn small wide" data-action="clear">Tampilkan semua tanggal</button>' : ''}</div>
      <div id="list">${listHTML()}</div>${fab('Tambah reservasi')}`;
  }
  const redraw = async () => { await load(); draw(); };

  function form(r) {
    const isEdit = !!r;
    openSheet(isEdit ? 'Edit Reservasi' : 'Tambah Reservasi', `
      <form id="f" novalidate>
        <label class="field"><span>Nama pemesan *</span><input type="text" name="name" required maxlength="80" value="${esc(r?.name)}" autocomplete="off"></label>
        <label class="field"><span>No. telepon</span><input type="tel" name="phone" inputmode="tel" maxlength="20" value="${esc(r?.phone)}"></label>
        <div class="two"><label class="field"><span>Tanggal *</span><input type="date" name="date" required value="${esc(r?.date || todayStr())}"></label>
        <label class="field"><span>Jam</span><input type="time" name="time" value="${esc(r?.time)}"></label></div>
        <div class="two"><label class="field"><span>Jumlah orang *</span><input type="number" name="pax" inputmode="numeric" min="1" required value="${r ? r.pax : 2}"></label>
        <label class="field"><span>Status</span><select name="status">${options(STATUS, r?.status || 'Menunggu')}</select></label></div>
        <label class="field"><span>Catatan</span><textarea name="note" maxlength="300">${esc(r?.note)}</textarea></label>
        <button class="btn primary block" type="submit">Simpan</button>
      </form>`, {
      lock: true,
      onMount: (body, close) => {
        body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = formData(e.target);
          const pax = Math.round(Number(d.pax));
          if (!d.name || !d.date) return toast('Nama dan tanggal wajib diisi', 'err');
          if (!(pax >= 1)) return toast('Jumlah orang minimal 1', 'err');
          await db.put('reservations', { id: r?.id || db.uid(), name: d.name, phone: d.phone, date: d.date, time: d.time, pax, status: d.status, note: d.note, createdAt: r?.createdAt || Date.now() });
          close();
          toast('Reservasi tersimpan');
          redraw();
        });
      },
    });
  }

  el.onclick = async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b || b.tagName === 'SELECT') return;
    const r = list.find((x) => x.id === b.dataset.id);
    const a = b.dataset.action;
    if (a === 'add') form(null);
    if (a === 'edit' && r) form(r);
    if (a === 'clear') { st.date = ''; draw(); }
    if (a === 'del' && r && (await confirmDialog(`Hapus reservasi ${r.name} tanggal ${fmtDate(r.date)}?`))) {
      await db.del('reservations', r.id);
      toast('Reservasi dihapus');
      redraw();
    }
    if (a === 'csv') {
      downloadCSV(`reservasi-penyetan234-${todayStr()}.csv`, toCSV([['Tanggal', 'Jam', 'Nama', 'Telepon', 'Jumlah Orang', 'Status', 'Catatan'], ...filtered().map((x) => [x.date, x.time, x.name, x.phone, x.pax, x.status, x.note])]));
    }
  };
  el.onchange = async (e) => {
    const t = e.target;
    if (t.id === 'date') { st.date = t.value; draw(); }
    else if (t.id === 'status') { st.status = t.value; el.querySelector('#list').innerHTML = listHTML(); }
    else if (t.dataset.action === 'status') {
      const r = list.find((x) => x.id === t.dataset.id);
      if (r) { await db.put('reservations', { ...r, status: t.value }); toast('Status diperbarui'); redraw(); }
    }
  };

  await load();
  draw();
}
