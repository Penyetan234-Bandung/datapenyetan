import * as db from '../db.js';
import { esc, rupiah, fmtDate, icon, emptyState, fab, openSheet, confirmDialog, toast, formData, downloadCSV } from '../util.js';
import { ordersOfCustomer, isBillable, outstanding, sum, toCSV, waNumber } from '../calc.js';
import { openOrderForm } from './orders.js';

const st = { q: '' };

export default async function (el) {
  let customers = [];
  let orders = [];

  async function load() {
    [customers, orders] = await Promise.all([db.getAll('customers'), db.getAll('orders')]);
  }

  function listHTML() {
    const q = st.q.toLowerCase();
    const list = customers
      .filter((c) => !q || [c.name, c.phone, c.company, c.address].some((v) => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
    if (!list.length) {
      return customers.length ? emptyState('Pelanggan tidak ditemukan', 'Coba kata kunci lain.') : emptyState('Belum ada pelanggan', 'Ketuk tombol + untuk menambah pelanggan. Data ini dipakai ulang saat membuat pesanan.');
    }
    return list.map((c) => {
      const os = ordersOfCustomer(c, orders);
      const total = sum(os.filter(isBillable).map((o) => o.total));
      return `<div class="card tap" data-action="detail" data-id="${c.id}">
        <div class="row between"><b style="font-size:16px">${esc(c.name)}</b><b class="muted">${rupiah(total)}</b></div>
        <div class="muted small">${[c.company, c.phone].filter(Boolean).map(esc).join(' · ') || 'Tanpa kontak'}</div>
        <div class="muted small">${os.length} pesanan</div></div>`;
    }).join('');
  }

  function draw() {
    el.innerHTML = `
      <div class="page-head"><h1>Pelanggan</h1><div class="head-actions"><button class="btn small" data-action="csv">Ekspor CSV</button></div></div>
      <div class="search">${icon('search', 20)}<input type="search" id="q" placeholder="Cari nama, telepon, instansi" value="${esc(st.q)}" autocomplete="off"></div>
      <div id="list">${listHTML()}</div>${fab('Tambah pelanggan')}`;
  }
  const redraw = async () => { await load(); draw(); };

  function form(c) {
    const isEdit = !!c;
    openSheet(isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan', `
      <form id="f" novalidate>
        <label class="field"><span>Nama pelanggan *</span><input type="text" name="name" required maxlength="80" value="${esc(c?.name)}" autocomplete="off"></label>
        <label class="field"><span>Nomor telepon</span><input type="tel" name="phone" inputmode="tel" maxlength="20" value="${esc(c?.phone)}"></label>
        <label class="field"><span>Alamat</span><textarea name="address" maxlength="250">${esc(c?.address)}</textarea></label>
        <label class="field"><span>Instansi / perusahaan</span><input type="text" name="company" maxlength="80" value="${esc(c?.company)}"></label>
        <label class="field"><span>Catatan</span><textarea name="note" maxlength="300">${esc(c?.note)}</textarea></label>
        <button class="btn primary block" type="submit">Simpan</button>
      </form>`, {
      lock: true,
      onMount: (body, close) => {
        body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = formData(e.target);
          if (!d.name) return toast('Nama pelanggan wajib diisi', 'err');
          const dup = customers.find((x) => x.id !== c?.id && x.name.toLowerCase() === d.name.toLowerCase());
          if (dup && !(await confirmDialog('Sudah ada pelanggan dengan nama yang sama. Tetap simpan?', { okText: 'Simpan', danger: false }))) return;
          const saved = { id: c?.id || db.uid(), name: d.name, phone: d.phone, address: d.address, company: d.company, note: d.note, createdAt: c?.createdAt || Date.now(), updatedAt: Date.now() };
          await db.put('customers', saved);
          // Samakan nama pada pesanan lama bila nama diubah (id tetap)
          if (c && c.name !== saved.name) {
            for (const o of ordersOfCustomer(c, orders)) await db.put('orders', { ...o, customerName: saved.name, customerId: saved.id });
          }
          close();
          toast(isEdit ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan');
          await redraw();
          if (isEdit) detail(saved.id);
        });
      },
    });
  }

  function detail(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    const os = ordersOfCustomer(c, orders).sort((a, b) => b.date.localeCompare(a.date));
    const total = sum(os.filter(isBillable).map((o) => o.total));
    const unpaid = sum(os.filter((o) => isBillable(o) && !o.paid).map(outstanding));
    const wa = waNumber(c.phone);
    openSheet(c.name, `
      <div class="stat-grid" style="margin-bottom:12px"><div class="stat in"><div class="lbl">Total transaksi</div><div class="val">${rupiah(total)}</div></div>
        <div class="stat ${unpaid ? 'out' : 'plain'}"><div class="lbl">Belum dibayar</div><div class="val">${rupiah(unpaid)}</div></div></div>
      <dl class="kv"><dt>Telepon</dt><dd>${esc(c.phone) || '-'}</dd><dt>Alamat</dt><dd>${esc(c.address) || '-'}</dd><dt>Instansi</dt><dd>${esc(c.company) || '-'}</dd><dt>Catatan</dt><dd>${esc(c.note) || '-'}</dd><dt>Jumlah pesanan</dt><dd>${os.length}</dd></dl>
      <h4 style="margin:14px 0 4px">Riwayat Pesanan</h4>
      ${os.length ? `<table class="items-table"><tbody>${os.map((o) => `<tr><td><b>${esc(o.no)}</b><div class="muted small">${fmtDate(o.date)} · ${o.status === 'selesai' ? 'Selesai' : 'Aktif'} · ${o.paid ? 'Lunas' : 'Belum lunas'}</div></td><td class="r">${rupiah(o.total)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Belum ada pesanan.</p>'}
      <div class="actions"><button class="btn primary" data-a="order">Buat Pesanan</button>${wa ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>` : ''}</div>
      <div class="actions"><button class="btn edit" data-a="edit">Edit</button><button class="btn danger" data-a="del">Hapus</button></div>`, {
      onMount: (body, close) => {
        body.addEventListener('click', async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (a === 'edit') { close(); form(c); }
          if (a === 'order') { close(); openOrderForm({ customer: c, onSaved: () => { location.hash = '#/pesanan'; } }); }
          if (a === 'del') {
            const extra = os.length ? ` Pesanan lama (${os.length}) tetap tersimpan dengan nama pelanggan ini.` : '';
            if (await confirmDialog(`Hapus pelanggan "${c.name}"?${extra}`)) {
              await db.del('customers', c.id);
              close();
              toast('Pelanggan dihapus');
              redraw();
            }
          }
        });
      },
    });
  }

  el.onclick = (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'add') form(null);
    if (b.dataset.action === 'detail') detail(b.dataset.id);
    if (b.dataset.action === 'csv') {
      downloadCSV('pelanggan-penyetan234.csv', toCSV([['Nama', 'Telepon', 'Alamat', 'Instansi', 'Catatan', 'Jumlah Pesanan', 'Total Transaksi'],
        ...customers.map((c) => { const os = ordersOfCustomer(c, orders); return [c.name, c.phone, c.address, c.company, c.note, os.length, sum(os.filter(isBillable).map((o) => o.total))]; })]));
    }
  };
  el.oninput = (e) => {
    if (e.target.id === 'q') { st.q = e.target.value; el.querySelector('#list').innerHTML = listHTML(); }
  };

  await load();
  draw();
}
