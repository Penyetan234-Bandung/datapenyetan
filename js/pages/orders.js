import * as db from '../db.js';
import { esc, rupiah, fmtDate, todayStr, icon, emptyState, fab, openSheet, confirmDialog, toast, formData, downloadCSV } from '../util.js';
import { orderTotal, orderBreakdown, isActive, inRange, periodRange, toCSV, waNumber } from '../calc.js';

const payText = (o) => (o.paid ? 'Lunas' : o.dp > 0 ? `DP ${rupiah(o.dp)}` : 'Belum lunas');
const payCls = (o) => (o.paid ? 'ok' : o.dp > 0 ? 'warn' : 'bad');
const srow = (l, v, cls = '') => `<div class="sumrow ${cls}"><span>${l}</span><span>${v}</span></div>`;

// Rincian subtotal, diskon, pajak, total, DP, sisa. Pesanan lama (tanpa rincian) hanya menampilkan total.
function breakdownHTML(o, label = 'Total') {
  const dp = o.dp || 0;
  let h = '';
  if (o.discount > 0 || o.tax > 0) h += srow('Subtotal', rupiah(o.subtotal ?? o.total));
  if (o.discount > 0) h += srow(`Diskon${o.discountType === 'pct' ? ` (${o.discountValue}%)` : ''}`, '-' + rupiah(o.discount));
  if (o.tax > 0) h += srow(`Pajak (${o.taxRate}%)`, rupiah(o.tax));
  h += `<div class="total-line"><span>${label}</span><span>${rupiah(o.total)}</span></div>`;
  if (dp > 0) {
    h += srow(`DP${o.dpDate ? ' (' + fmtDate(o.dpDate) + ')' : ''}`, '-' + rupiah(dp));
    h += o.paid ? srow('Pelunasan', rupiah(o.total - dp)) : `<div class="total-line"><span>Sisa Tagihan</span><span>${rupiah(o.total - dp)}</span></div>`;
  }
  return h;
}
function waExtra(o) {
  let t = '';
  if (o.discount > 0 || o.tax > 0) t += `Subtotal: ${rupiah(o.subtotal ?? o.total)}\n`;
  if (o.discount > 0) t += `Diskon: -${rupiah(o.discount)}\n`;
  if (o.tax > 0) t += `Pajak (${o.taxRate}%): ${rupiah(o.tax)}\n`;
  return t;
}

const st = { q: '', period: 'bulan', from: '', to: '', filter: 'semua' };
const pad = (n, w = 4) => String(n).padStart(w, '0');

/* ---------- Form pesanan (juga dipakai halaman Pelanggan) ---------- */
export async function openOrderForm({ order = null, customer = null, onSaved } = {}) {
  const [customers, menus] = await Promise.all([db.getAll('customers'), db.getAll('menus')]);
  const avail = menus.filter((m) => m.available !== false);
  const isEdit = !!order;
  const prefill = order || { customerId: customer?.id || '', customerName: customer?.name || '', phone: customer?.phone || '', date: todayStr(), items: [{ name: '', qty: 1, price: '' }], note: '' };

  const rowHTML = (it) => `
    <div class="item-row">
      <div class="row"><input type="text" class="i-name" list="dl-menu" placeholder="Nama menu" value="${esc(it.name)}" autocomplete="off" aria-label="Nama menu"><button type="button" class="rm" data-rm>Hapus</button></div>
      <div class="grid"><input type="number" class="i-qty" inputmode="decimal" min="0" step="1" value="${it.qty}" aria-label="Jumlah"><input type="number" class="i-price" inputmode="numeric" min="0" placeholder="Harga satuan" value="${it.price}" aria-label="Harga satuan" data-manual="${it.price !== '' ? 1 : 0}">
      <div class="sub">Subtotal: <span class="i-sub">Rp 0</span></div></div>
    </div>`;

  const pf = { discountType: prefill.discountType || 'rp', discountValue: prefill.discountValue || '', taxRate: prefill.taxRate || '', dp: prefill.dp || '', dpDate: prefill.dpDate || prefill.date };
  openSheet(isEdit ? `Edit ${order.no}` : 'Pesanan Baru', `
    <form id="f" novalidate>
      <label class="field"><span>Nama pelanggan *</span><input type="text" name="customerName" list="dl-cust" maxlength="80" required value="${esc(prefill.customerName)}" autocomplete="off"></label>
      <div class="two"><label class="field"><span>No. telepon</span><input type="tel" name="phone" inputmode="tel" maxlength="20" value="${esc(prefill.phone)}"></label>
      <label class="field"><span>Tanggal *</span><input type="date" name="date" required value="${esc(prefill.date)}"></label></div>
      <datalist id="dl-cust">${customers.map((c) => `<option value="${esc(c.name)}">`).join('')}</datalist>
      <datalist id="dl-menu">${avail.map((m) => `<option value="${esc(m.name)}">${rupiah(m.price)}</option>`).join('')}</datalist>
      <div class="field"><span>Daftar menu *</span><div id="items">${prefill.items.map(rowHTML).join('')}</div>
        <button type="button" class="btn small" id="add-item">+ Tambah item</button>
        ${avail.length ? '' : '<div class="note">Menu belum diisi. Anda tetap bisa mengetik nama dan harga manual, atau isi dulu di halaman Menu.</div>'}</div>
      <div class="card" style="background:#F8FAFC">
        <div class="two"><label class="field"><span>Diskon</span><div class="row"><select name="discountType" style="width:74px;flex:none"><option value="rp" ${pf.discountType === 'rp' ? 'selected' : ''}>Rp</option><option value="pct" ${pf.discountType === 'pct' ? 'selected' : ''}>%</option></select><input type="number" name="discountValue" inputmode="decimal" min="0" step="any" value="${pf.discountValue}" placeholder="0"></div></label>
        <label class="field"><span>Pajak (%)</span><input type="number" name="taxRate" inputmode="decimal" min="0" max="100" step="any" value="${pf.taxRate}" placeholder="0"></label></div>
        <div class="two"><label class="field"><span>DP / uang muka (Rp)</span><input type="number" name="dp" inputmode="numeric" min="0" value="${pf.dp}" placeholder="0"></label>
        <label class="field" id="dpdate-wrap"><span>Tanggal DP</span><input type="date" name="dpDate" value="${esc(pf.dpDate)}"></label></div>
        <div class="sumrow"><span>Subtotal</span><span id="r-sub">Rp 0</span></div>
        <div class="sumrow"><span>Diskon</span><span id="r-disc">Rp 0</span></div>
        <div class="sumrow"><span>Pajak</span><span id="r-tax">Rp 0</span></div>
        <div class="total-line" style="margin:6px 0"><span>Total</span><span id="total">Rp 0</span></div>
        <div class="sumrow"><span>DP</span><span id="r-dp">Rp 0</span></div>
        <div class="sumrow strong"><span>Sisa tagihan</span><span id="r-rem">Rp 0</span></div>
      </div>
      <label class="field"><span>Catatan</span><textarea name="note" maxlength="300">${esc(prefill.note)}</textarea></label>
      <label class="row field" id="savecust-wrap" style="gap:10px"><input type="checkbox" name="saveCust" checked style="width:22px;height:22px"><span style="margin:0">Simpan pelanggan baru ke daftar pelanggan</span></label>
      <button class="btn primary block" type="submit">Simpan Pesanan</button>
    </form>`, {
    lock: true,
    onMount: (body, close) => {
      const form = body.querySelector('#f');
      const itemsEl = body.querySelector('#items');
      const readItems = () => [...itemsEl.querySelectorAll('.item-row')].map((r) => ({
        name: r.querySelector('.i-name').value.trim(),
        qty: parseFloat(r.querySelector('.i-qty').value),
        price: r.querySelector('.i-price').value === '' ? NaN : Number(r.querySelector('.i-price').value),
        row: r,
      }));
      const opts = () => ({ discountType: form.discountType.value, discountValue: form.discountValue.value, taxRate: form.taxRate.value, dp: form.dp.value });
      const recalc = () => {
        let subtotal = 0;
        for (const it of readItems()) {
          const sub = Number.isFinite(it.qty) && Number.isFinite(it.price) ? Math.round(it.qty * it.price) : 0;
          it.row.querySelector('.i-sub').textContent = rupiah(sub);
          subtotal += sub;
        }
        const bd = orderBreakdown(subtotal, opts());
        const set = (id, v) => { body.querySelector(id).textContent = v; };
        set('#r-sub', rupiah(bd.subtotal)); set('#r-disc', bd.discount ? '-' + rupiah(bd.discount) : rupiah(0)); set('#r-tax', rupiah(bd.tax));
        set('#total', rupiah(bd.total)); set('#r-dp', bd.dp ? '-' + rupiah(bd.dp) : rupiah(0)); set('#r-rem', rupiah(bd.remaining));
        body.querySelector('#dpdate-wrap').style.display = bd.dp > 0 ? '' : 'none';
        return bd;
      };
      const syncCust = () => {
        const name = form.customerName.value.trim().toLowerCase();
        const c = customers.find((x) => x.name.toLowerCase() === name);
        body.querySelector('#savecust-wrap').style.display = c ? 'none' : '';
        return c;
      };
      recalc();
      syncCust();

      form.addEventListener('input', (e) => {
        const t = e.target;
        if (t.classList.contains('i-price')) t.dataset.manual = '1';
        if (t.classList.contains('i-name')) {
          const m = avail.find((x) => x.name.toLowerCase() === t.value.trim().toLowerCase());
          const priceEl = t.closest('.item-row').querySelector('.i-price');
          if (m && priceEl.dataset.manual !== '1') priceEl.value = m.price;
        }
        if (t.name === 'customerName') {
          const c = syncCust();
          if (c && !form.phone.value) form.phone.value = c.phone || '';
        }
        recalc();
      });
      body.querySelector('#add-item').onclick = () => {
        itemsEl.insertAdjacentHTML('beforeend', rowHTML({ name: '', qty: 1, price: '' }));
        itemsEl.lastElementChild.querySelector('.i-name').focus();
      };
      itemsEl.addEventListener('click', (e) => {
        if (!e.target.closest('[data-rm]')) return;
        if (itemsEl.children.length === 1) return toast('Minimal satu item', 'err');
        e.target.closest('.item-row').remove();
        recalc();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = formData(form);
        if (!d.customerName) return toast('Nama pelanggan wajib diisi', 'err');
        if (!d.date) return toast('Tanggal wajib diisi', 'err');
        const raw = readItems().filter((i) => i.name || Number.isFinite(i.price));
        if (!raw.length) return toast('Tambahkan minimal satu menu', 'err');
        for (const i of raw) {
          if (!i.name) return toast('Ada item tanpa nama menu', 'err');
          if (!(i.qty > 0)) return toast(`Jumlah "${i.name}" harus lebih dari 0`, 'err');
          if (!Number.isFinite(i.price) || i.price < 0) return toast(`Harga "${i.name}" belum diisi`, 'err');
        }
        const items = raw.map((i) => {
          const m = menus.find((x) => x.name.toLowerCase() === i.name.toLowerCase());
          return { menuId: m?.id || null, name: i.name, qty: i.qty, price: Math.round(i.price) }; // harga disalin (snapshot)
        });

        const subtotal = orderTotal(items);
        const dv = Number(d.discountValue || 0), tr = Number(d.taxRate || 0), dpv = Number(d.dp || 0);
        if (!(dv >= 0)) return toast('Diskon tidak valid', 'err');
        if (d.discountType === 'pct' && dv > 100) return toast('Diskon maksimal 100%', 'err');
        if (d.discountType === 'rp' && dv > subtotal) return toast('Diskon melebihi subtotal', 'err');
        if (!(tr >= 0 && tr <= 100)) return toast('Pajak harus antara 0 dan 100%', 'err');
        if (!(dpv >= 0)) return toast('DP tidak valid', 'err');
        const bd = orderBreakdown(subtotal, { discountType: d.discountType, discountValue: dv, taxRate: tr, dp: dpv });
        if (bd.dp > bd.total) return toast('DP melebihi total pesanan', 'err');

        let cust = customers.find((c) => c.name.toLowerCase() === d.customerName.toLowerCase());
        if (!cust && form.saveCust.checked) {
          cust = { id: db.uid(), name: d.customerName, phone: d.phone, address: '', company: '', note: '', createdAt: Date.now() };
          await db.put('customers', cust);
        } else if (cust && d.phone && !cust.phone) {
          await db.put('customers', { ...cust, phone: d.phone });
        }

        const base = order || {
          id: db.uid(), no: 'P-' + pad(await db.nextCounter('order')), status: 'aktif', paid: false, paidDate: null,
          invoice: null, createdAt: Date.now(),
        };
        const saved = { ...base, customerId: cust?.id || null, customerName: d.customerName, phone: d.phone, date: d.date, items, subtotal, discountType: d.discountType, discountValue: dv, discount: bd.discount, taxRate: tr, tax: bd.tax, total: bd.total, dp: bd.dp, dpDate: bd.dp > 0 ? d.dpDate || d.date : null, note: d.note, updatedAt: Date.now() };
        await db.put('orders', saved);
        close();
        toast(isEdit ? 'Pesanan diperbarui' : `Pesanan ${saved.no} tersimpan`);
        if (onSaved) onSaved(saved);
      });
    },
  });
}

/* ---------- Halaman ---------- */
export default async function (el) {
  let orders = [];
  let profile = null;

  async function load() {
    [orders, profile] = await Promise.all([db.getAll('orders'), db.getProfile()]);
  }

  function filtered() {
    const r = periodRange(st.period, st.from, st.to);
    const q = st.q.toLowerCase();
    return orders
      .filter((o) => inRange(o.date, r.from, r.to))
      .filter((o) => {
        if (st.filter === 'aktif') return o.status !== 'selesai';
        if (st.filter === 'selesai') return o.status === 'selesai';
        if (st.filter === 'belum') return !o.paid;
        if (st.filter === 'lunas') return o.paid;
        return true;
      })
      .filter((o) => !q || o.customerName.toLowerCase().includes(q) || o.no.toLowerCase().includes(q) || o.items.some((i) => i.name.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no));
  }

  const itemSummary = (o) => o.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(', ');

  function listHTML() {
    const list = filtered();
    if (!list.length) {
      return orders.length ? emptyState('Tidak ada pesanan', 'Tidak ada pesanan yang cocok dengan pencarian atau filter.') : emptyState('Belum ada pesanan', 'Ketuk tombol + untuk membuat pesanan pertama.');
    }
    return list.map((o) => `
      <div class="card tap order-card" data-action="detail" data-id="${o.id}">
        <div class="row between"><b>${esc(o.no)}</b><span class="muted small">${fmtDate(o.date)}</span></div>
        <div class="name">${esc(o.customerName)}</div>
        <div class="muted small" style="margin-bottom:8px">${itemSummary(o)}</div>
        <div class="row between"><div class="badges">
          <span class="badge ${o.status === 'selesai' ? 'ok' : 'act'}">${o.status === 'selesai' ? 'Selesai' : 'Aktif'}</span>
          <span class="badge ${payCls(o)}">${payText(o)}</span>
          ${o.invoice ? `<span class="badge">${esc(o.invoice.no)}</span>` : ''}</div><b>${rupiah(o.total)}</b></div>
      </div>`).join('');
  }

  function draw() {
    el.innerHTML = `
      <div class="page-head"><h1>Pesanan</h1><div class="head-actions"><button class="btn small" data-action="csv">Ekspor CSV</button></div></div>
      <div class="search">${icon('search', 20)}<input type="search" id="q" placeholder="Cari pelanggan atau menu" value="${esc(st.q)}" autocomplete="off"></div>
      <div class="filters">
        <select id="period" aria-label="Periode"><option value="bulan">Bulan ini</option><option value="lalu">Bulan lalu</option><option value="semua">Semua waktu</option><option value="rentang">Pilih tanggal…</option></select>
        <select id="filter" aria-label="Status"><option value="semua">Semua status</option><option value="aktif">Aktif</option><option value="selesai">Selesai</option><option value="belum">Belum lunas</option><option value="lunas">Lunas</option></select>
        ${st.period === 'rentang' ? `<input type="date" id="from" value="${st.from}" aria-label="Dari"><input type="date" id="to" value="${st.to}" aria-label="Sampai">` : ''}
      </div>
      <div id="list">${listHTML()}</div>${fab('Pesanan baru')}`;
    el.querySelector('#period').value = st.period;
    el.querySelector('#filter').value = st.filter;
  }

  const redraw = async () => { await load(); draw(); };

  /* Detail */
  function detail(id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const btns = [];
    if (o.status !== 'selesai') btns.push('<button class="btn primary" data-a="done">Tandai Selesai</button>');
    else if (!o.paid) btns.push('<button class="btn" data-a="reopen">Aktifkan Kembali</button>');
    btns.push(o.invoice ? '<button class="btn" data-a="invoice">Lihat Faktur</button>' : '<button class="btn" data-a="mkinvoice">Buat Faktur</button>');
    btns.push(o.paid ? '<button class="btn" data-a="unpay">Batalkan Lunas</button>' : '<button class="btn primary" data-a="pay">Tandai Lunas</button>');
    openSheet(o.no, `
      <div class="badges" style="margin-bottom:6px"><span class="badge ${o.status === 'selesai' ? 'ok' : 'act'}">Pesanan: ${o.status === 'selesai' ? 'Selesai' : 'Aktif'}</span>
        <span class="badge ${payCls(o)}">Pembayaran: ${payText(o)}</span>${o.invoice ? `<span class="badge">Faktur ${esc(o.invoice.no)}</span>` : '<span class="badge warn">Belum difakturkan</span>'}</div>
      <dl class="kv"><dt>Pelanggan</dt><dd>${esc(o.customerName)}</dd><dt>Telepon</dt><dd>${esc(o.phone) || '-'}</dd><dt>Tanggal</dt><dd>${fmtDate(o.date)}</dd>
        ${o.paid ? `<dt>Dibayar</dt><dd>${fmtDate(o.paidDate)}${o.payMethod ? ' · ' + esc(o.payMethod) : ''}</dd>` : ''}<dt>Catatan</dt><dd>${esc(o.note) || '-'}</dd></dl>
      <table class="items-table"><thead><tr><th>Menu</th><th class="r">Harga</th><th class="r">Jml</th><th class="r">Subtotal</th></tr></thead><tbody>
        ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${rupiah(i.price)}</td><td class="r">${i.qty}</td><td class="r">${rupiah(Math.round(i.qty * i.price))}</td></tr>`).join('')}</tbody></table>
      ${breakdownHTML(o)}
      <div class="actions">${btns.join('')}</div>
      <div class="actions"><button class="btn edit" data-a="edit">Edit</button><button class="btn danger" data-a="del">Hapus</button></div>`, {
      onMount: (body, close) => {
        body.addEventListener('click', async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (!a) return;
          const again = async () => { close(); await redraw(); detail(id); };
          if (a === 'done') { await db.put('orders', { ...o, status: 'selesai', doneDate: todayStr() }); toast('Pesanan ditandai selesai'); return again(); }
          if (a === 'reopen') { await db.put('orders', { ...o, status: 'aktif', doneDate: null }); toast('Pesanan diaktifkan kembali'); return again(); }
          if (a === 'mkinvoice') { await makeInvoice(o); toast('Faktur dibuat'); return again(); }
          if (a === 'invoice') { close(); return showInvoice(o); }
          if (a === 'pay') { close(); return paySheet(o); }
          if (a === 'unpay') {
            if (await confirmDialog('Batalkan status lunas pesanan ini?', { okText: 'Batalkan Lunas', danger: false })) {
              await db.put('orders', { ...o, paid: false, paidDate: null, payMethod: null });
              toast('Status lunas dibatalkan');
              return again();
            }
            return;
          }
          if (a === 'edit') {
            if (o.paid) return toast('Pesanan lunas tidak bisa diedit. Batalkan lunas dulu.', 'err');
            close();
            return openOrderForm({ order: o, onSaved: async (s) => { await redraw(); detail(s.id); } });
          }
          if (a === 'del') {
            if (await confirmDialog(`Hapus pesanan ${o.no} atas nama ${o.customerName}? Tindakan ini tidak bisa dibatalkan.`)) {
              await db.del('orders', o.id);
              close();
              toast('Pesanan dihapus');
              redraw();
            }
          }
        });
      },
    });
  }

  async function makeInvoice(o) {
    if (o.invoice) return o;
    const inv = { no: 'F-' + pad(await db.nextCounter('invoice')), date: todayStr() };
    const updated = { ...o, invoice: inv };
    await db.put('orders', updated);
    return updated;
  }

  function paySheet(o) {
    openSheet('Tandai Lunas', `
      <form id="f"><p class="muted" style="margin-top:0">${esc(o.no)} · ${esc(o.customerName)} · <b>${rupiah(o.total)}</b>${o.dp > 0 ? `<br>DP sudah dibayar ${rupiah(o.dp)} · <b>sisa ${rupiah(o.total - o.dp)}</b>` : ''}</p>
        <label class="field"><span>Tanggal pembayaran</span><input type="date" name="date" value="${todayStr()}" required></label>
        <label class="field"><span>Metode</span><select name="method"><option>Tunai</option><option>Transfer</option><option>QRIS</option><option>Lainnya</option></select></label>
        ${o.invoice ? '' : '<div class="note info">Faktur akan dibuat otomatis saat ditandai lunas.</div>'}
        <button class="btn primary block" type="submit">Konfirmasi Lunas</button></form>`, {
      lock: true,
      onMount: (body, close) => {
        body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = formData(e.target);
          if (!d.date) return toast('Tanggal wajib diisi', 'err');
          const withInv = await makeInvoice(o);
          await db.put('orders', { ...withInv, paid: true, paidDate: d.date, payMethod: d.method });
          close();
          toast('Pesanan lunas');
          await redraw();
          detail(o.id);
        });
      },
    });
  }

  function showInvoice(o) {
    const biz = profile;
    const text = `*${biz.businessName}*\nFaktur ${o.invoice.no}\nTanggal: ${fmtDate(o.invoice.date)}\nPelanggan: ${o.customerName}\n\n${o.items.map((i) => `${i.qty}x ${i.name} @ ${rupiah(i.price)} = ${rupiah(Math.round(i.qty * i.price))}`).join('\n')}\n\n${waExtra(o)}Total: ${rupiah(o.total)}${o.dp > 0 ? `\nDP: ${rupiah(o.dp)}` + (o.paid ? '' : `\nSisa: ${rupiah(o.total - o.dp)}`) : ''}\nStatus: ${o.paid ? 'LUNAS' : 'BELUM LUNAS'}`;
    const wa = waNumber(o.phone);
    openSheet('Faktur', `
      <div class="invoice" id="invoice-print">
        <div class="row between"><div class="row"><img class="invoice-logo" src="icons/logo-320.png" alt="Logo Penyetan 234"><div><h2>${esc(biz.businessName)}</h2><div class="muted small">${esc(biz.address)}${biz.phone ? ' · ' + esc(biz.phone) : ''}</div></div></div><span class="stamp ${o.paid ? 'ok' : 'bad'}">${o.paid ? 'LUNAS' : 'BELUM LUNAS'}</span></div>
        <hr style="border:0;border-top:1px solid var(--line);margin:12px 0">
        <dl class="kv"><dt>No. Faktur</dt><dd><b>${esc(o.invoice.no)}</b></dd><dt>Tgl. Faktur</dt><dd>${fmtDate(o.invoice.date)}</dd><dt>No. Pesanan</dt><dd>${esc(o.no)}</dd><dt>Pelanggan</dt><dd>${esc(o.customerName)}</dd>${o.paid ? `<dt>Dibayar</dt><dd>${fmtDate(o.paidDate)}</dd>` : ''}</dl>
        <table class="items-table"><thead><tr><th>Menu</th><th class="r">Harga</th><th class="r">Jml</th><th class="r">Subtotal</th></tr></thead><tbody>
          ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td class="r">${rupiah(i.price)}</td><td class="r">${i.qty}</td><td class="r">${rupiah(Math.round(i.qty * i.price))}</td></tr>`).join('')}</tbody></table>
        ${breakdownHTML(o, 'Total Tagihan')}
        ${o.note ? `<div class="muted small">Catatan: ${esc(o.note)}</div>` : ''}
      </div>
      <div class="actions no-print"><button class="btn primary" data-a="print">Cetak / Simpan PDF</button>
        <a class="btn" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(text)}">Kirim WhatsApp</a></div>
      <div class="actions no-print"><button class="btn" data-a="back">Kembali ke pesanan</button></div>`, {
      onMount: (body, close) => {
        body.addEventListener('click', (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (a === 'print') window.print();
          if (a === 'back') { close(); detail(o.id); }
        });
      },
    });
  }

  function exportCSV() {
    const rows = [['No Pesanan', 'Tanggal', 'Pelanggan', 'Telepon', 'Menu', 'Subtotal', 'Diskon', 'Pajak', 'Total', 'DP', 'Sisa Tagihan', 'Catatan', 'Status Pesanan', 'No Faktur', 'Status Pembayaran', 'Tanggal Bayar']];
    for (const o of filtered()) {
      rows.push([o.no, o.date, o.customerName, o.phone, o.items.map((i) => `${i.qty}x ${i.name} @${i.price}`).join('; '), o.subtotal ?? o.total, o.discount || 0, o.tax || 0, o.total, o.dp || 0, o.paid ? 0 : o.total - (o.dp || 0), o.note,
        o.status === 'selesai' ? 'Selesai' : 'Aktif', o.invoice?.no || '', o.paid ? 'Lunas' : o.dp > 0 ? 'DP' : 'Belum lunas', o.paidDate || '']);
    }
    downloadCSV(`pesanan-penyetan234-${todayStr()}.csv`, toCSV(rows));
  }

  el.onclick = (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    if (b.dataset.action === 'add') openOrderForm({ onSaved: redraw });
    if (b.dataset.action === 'detail') detail(b.dataset.id);
    if (b.dataset.action === 'csv') exportCSV();
  };
  el.oninput = (e) => {
    if (e.target.id === 'q') { st.q = e.target.value; el.querySelector('#list').innerHTML = listHTML(); }
  };
  el.onchange = (e) => {
    const id = e.target.id;
    if (id === 'period') { st.period = e.target.value; draw(); }
    else if (id === 'filter') { st.filter = e.target.value; el.querySelector('#list').innerHTML = listHTML(); }
    else if (id === 'from' || id === 'to') { st[id] = e.target.value; el.querySelector('#list').innerHTML = listHTML(); }
  };

  await load();
  draw();
}
