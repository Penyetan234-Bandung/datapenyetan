import * as db from '../db.js';
import { esc, rupiah, icon, emptyState, fab, openSheet, confirmDialog, toast, formData, options, downloadCSV } from '../util.js';
import { toCSV } from '../calc.js';

const st = { q: '', cat: '' };

export default async function (el) {
  async function draw() {
    const [menus, profile] = await Promise.all([db.getAll('menus'), db.getProfile()]);
    const cats = [...new Set([...profile.menuCategories, ...menus.map((m) => m.category).filter(Boolean)])];
    el._menus = menus;
    el._cats = cats;
    el.innerHTML = `
      <div class="page-head"><h1>Menu</h1><div class="head-actions"><button class="btn small" data-action="csv">Ekspor CSV</button></div></div>
      <div class="search">${icon('search', 20)}<input type="search" id="q" placeholder="Cari menu" value="${esc(st.q)}" autocomplete="off"></div>
      <div class="chips"><button class="chip ${st.cat ? '' : 'on'}" data-cat="">Semua</button>${cats.map((c) => `<button class="chip ${st.cat === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div id="list">${listHTML()}</div>${fab('Tambah menu')}`;
  }

  function listHTML() {
    const menus = el._menus;
    const q = st.q.toLowerCase();
    const list = menus
      .filter((m) => (!st.cat || m.category === st.cat) && (!q || m.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
    return `${
        list.length
          ? list.map((m) => `
        <div class="card menu-item ${m.available === false ? 'dim' : ''}">
          <div class="grow"><div class="name">${esc(m.name)}</div>
            <div class="badges" style="margin-top:4px">${m.category ? `<span class="badge">${esc(m.category)}</span>` : ''}${m.available === false ? '<span class="badge warn">Tidak tersedia</span>' : ''}</div></div>
          <div class="right"><div class="price">${rupiah(m.price)}</div>
            <div class="btn-pair"><button class="btn small edit" data-action="edit" data-id="${m.id}">Edit</button><button class="btn small danger" data-action="del" data-id="${m.id}">Hapus</button></div></div>
        </div>`).join('')
          : menus.length
            ? emptyState('Menu tidak ditemukan', 'Ubah kata kunci atau kategori.')
            : emptyState('Belum ada menu', 'Ketuk tombol + untuk menambah menu Penyetan 234 beserta harganya. Harga yang Anda isi di sini hanya mengikuti data Anda sendiri.')
      }`;
  }

  function form(m) {
    const isEdit = !!m;
    const cats = el._cats;
    openSheet(isEdit ? 'Edit Menu' : 'Tambah Menu', `
      <form id="f" novalidate>
        <label class="field"><span>Nama menu *</span><input type="text" name="name" required maxlength="80" value="${esc(m?.name)}" autocomplete="off"></label>
        <label class="field"><span>Kategori</span><input type="text" name="category" list="dl-cat" maxlength="40" value="${esc(m?.category || cats[0] || '')}" placeholder="mis. Makanan / Minuman"><datalist id="dl-cat">${options(cats)}</datalist></label>
        <label class="field"><span>Harga jual (Rp) *</span><input type="number" name="price" inputmode="numeric" min="0" step="500" required value="${m ? m.price : ''}"></label>
        <label class="row field" style="gap:10px"><input type="checkbox" name="available" ${m?.available === false ? '' : 'checked'} style="width:22px;height:22px"><span style="margin:0">Tersedia dijual</span></label>
        ${isEdit ? '<div class="note info">Mengubah harga tidak mengubah harga pada pesanan yang sudah tercatat.</div>' : ''}
        <button class="btn primary block" type="submit">Simpan</button>
      </form>`, {
      lock: true,
      onMount: (body, close) => {
        body.querySelector('#f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = formData(e.target);
          const price = Number(d.price);
          if (!d.name) return toast('Nama menu wajib diisi', 'err');
          if (!Number.isFinite(price) || price < 0 || d.price === '') return toast('Harga tidak valid', 'err');
          const dup = el._menus.find((x) => x.id !== m?.id && x.name.toLowerCase() === d.name.toLowerCase());
          if (dup && !(await confirmDialog('Sudah ada menu dengan nama yang sama. Tetap simpan?', { okText: 'Simpan', danger: false }))) return;
          await db.put('menus', {
            id: m?.id || db.uid(), name: d.name, category: d.category, price: Math.round(price),
            available: e.target.available.checked, createdAt: m?.createdAt || Date.now(), updatedAt: Date.now(),
          });
          close();
          toast(isEdit ? 'Menu diperbarui' : 'Menu ditambahkan');
          draw();
        });
      },
    });
  }

  el.onclick = async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { st.cat = cat.dataset.cat; return draw(); }
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const m = el._menus.find((x) => x.id === b.dataset.id);
    if (b.dataset.action === 'add') form(null);
    if (b.dataset.action === 'edit' && m) form(m);
    if (b.dataset.action === 'del' && m) {
      if (await confirmDialog(`Hapus menu "${m.name}"? Riwayat pesanan lama tetap utuh.`)) {
        await db.del('menus', m.id);
        toast('Menu dihapus');
        draw();
      }
    }
    if (b.dataset.action === 'csv') {
      downloadCSV('menu-penyetan234.csv', toCSV([['Nama', 'Kategori', 'Harga', 'Tersedia'], ...el._menus.map((x) => [x.name, x.category, x.price, x.available === false ? 'Tidak' : 'Ya'])]));
    }
  };
  el.oninput = (e) => {
    if (e.target.id === 'q') {
      st.q = e.target.value;
      el.querySelector('#list').innerHTML = listHTML();
    }
  };
  await draw();
}
