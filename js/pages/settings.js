import * as db from '../db.js';
import { esc, toast, formData, pageHeader } from '../util.js';

const split = (s) => [...new Set(String(s || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean))];

export default async function (el) {
  const p = await db.getProfile();
  el.innerHTML = `
    ${pageHeader('Pengaturan Aplikasi', { back: '#/lainnya' })}
    <form id="f" novalidate>
      <label class="field"><span>Nama usaha (tampil di faktur)</span><input type="text" name="businessName" maxlength="60" value="${esc(p.businessName)}"></label>
      <label class="field"><span>Alamat</span><textarea name="address" maxlength="250">${esc(p.address)}</textarea></label>
      <label class="field"><span>Telepon usaha</span><input type="tel" name="phone" maxlength="20" value="${esc(p.phone)}"></label>
      <label class="field"><span>Kategori menu (pisahkan dengan koma)</span><textarea name="menuCategories">${esc(p.menuCategories.join(', '))}</textarea></label>
      <label class="field"><span>Kategori belanja (pisahkan dengan koma)</span><textarea name="expenseCategories">${esc(p.expenseCategories.join(', '))}</textarea></label>
      <div class="note info">Kategori hanyalah saran pilihan. Data lama dengan kategori yang dihapus dari daftar ini tetap tersimpan.</div>
      <button class="btn primary block" type="submit">Simpan Pengaturan</button>
    </form>`;
  el.onsubmit = async (e) => {
    e.preventDefault();
    const d = formData(e.target);
    await db.put('settings', {
      ...p, key: 'profile', businessName: d.businessName || 'Penyetan 234', address: d.address, phone: d.phone,
      menuCategories: split(d.menuCategories), expenseCategories: split(d.expenseCategories),
    });
    toast('Pengaturan tersimpan');
  };
}
