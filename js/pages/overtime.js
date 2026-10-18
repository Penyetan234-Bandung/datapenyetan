import * as db from '../db.js';
import { esc, rupiah, fmtDate, todayStr, emptyState, fab, openSheet, confirmDialog, toast, formData, options, downloadCSV, pageHeader } from '../util.js';
import { MONTHS, toCSV, overtimeMinutes, fmtDuration, overtimePay, sum } from '../calc.js';

const st = { month: todayStr().slice(0, 7) };

export default async function (el) {
  let list = [];
  const load = async () => { list = await db.getAll('overtime'); };
  const inMonth = () => list.filter((a) => a.date.slice(0, 7) === st.month)
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'id'));

  function draw() {
    const rows = inMonth();
    const by = new Map();
    for (const a of rows) {
      const r = by.get(a.name) || { name: a.name, days: 0, min: 0, pay: 0 };
      r.days++; r.min += a.minutes; r.pay += a.pay || 0;
      by.set(a.name, r);
    }
    const [y, m] = st.month.split('-').map(Number);
    const totalMin = sum(rows.map((a) => a.minutes));
    el.innerHTML = `
      ${pageHeader('Lembur Karyawan', { back: '#/lainnya', actions: '<button class="btn small" data-action="csv">Ekspor CSV</button>' })}
      <label class="field"><span>Bulan</span><input type="month" id="month" value="${st.month}"></label>
      <div class="stat-grid" style="margin-bottom:10px">
        <div class="stat act"><div class="lbl">Total jam lembur</div><div class="val">${fmtDuration(totalMin)}</div></div>
        <div class="stat plain"><div class="lbl">Total upah lembur</div><div class="val">${rupiah(sum(rows.map((a) => a.pay || 0)))}</div></div>
      </div>
      ${rows.length ? rows.map((a) => `
        <div class="card"><div class="row between"><b style="font-size:16px">${esc(a.name)}</b><span class="badge act">${fmtDuration(a.minutes)}</span></div>
          <div class="muted small">${fmtDate(a.date)} · ${esc(a.start)}–${esc(a.end)}${a.start >= a.end ? ' (lewat tengah malam)' : ''}${a.pay ? ' · ' + rupiah(a.pay) : ''}</div>
          ${a.reason ? `<div class="small" style="margin-top:4px">${esc(a.reason)}</div>` : ''}
          <div class="btn-pair" style="margin-top:8px;justify-content:flex-end"><button class="btn small edit" data-action="edit" data-id="${a.id}">Edit</button><button class="btn small danger" data-action="del" data-id="${a.id}">Hapus</button></div></div>`).join('')
        : emptyState('Belum ada lembur', `Belum ada catatan lembur untuk ${MONTHS[m - 1]} ${y}. Ketuk + untuk menambah.`)}
      <h2 class="section-title">Rekap ${MONTHS[m - 1]} ${y}</h2>
      <div class="card">${by.size ? `<table class="report-table"><thead><tr><th>Nama</th><th class="r">Hari</th><th class="r">Jam</th><th class="r">Upah</th></tr></thead><tbody>
        ${[...by.values()].sort((a, b) => a.name.localeCompare(b.name, 'id')).map((r) => `<tr><td>${esc(r.name)}</td><td class="r">${r.days}</td><td class="r">${fmtDuration(r.min)}</td><td class="r">${r.pay ? rupiah(r.pay) : '-'}</td></tr>`).join('')}</tbody></table>` : '<div class="chart-empty">Belum ada data bulan ini</div>'}</div>
      ${fab('Tambah lembur')}`;
  }
  const redraw = async () => { await load(); draw(); };

  function form(a) {
    const isEdit = !!a;
    const names = [...new Set(list.map((x) => x.name))];
    openSheet(isEdit ? 'Edit Lembur' : 'Tambah Lembur', `
      <form id="f" novalidate>
        <label class="field"><span>Nama karyawan *</span><input type="text" name="name" list="dl-emp" required maxlength="60" value="${esc(a?.name)}" autocomplete="off"><datalist id="dl-emp">${options(names)}</datalist></label>
        <label class="field"><span>Tanggal *</span><input type="date" name="date" required value="${esc(a?.date || (st.month === todayStr().slice(0, 7) ? todayStr() : st.month + '-01'))}"></label>
        <div class="two"><label class="field"><span>Jam mulai *</span><input type="time" name="start" required value="${esc(a?.start)}"></label>
        <label class="field"><span>Jam selesai *</span><input type="time" name="end" required value="${esc(a?.end)}"></label></div>
        <div class="total-line"><span>Durasi</span><span id="dur">-</span></div>
        <label class="field"><span>Tarif lembur per jam (Rp, opsional)</span><input type="number" name="rate" inputmode="numeric" min="0" value="${a?.rate ?? ''}" placeholder="Kosongkan bila tidak dihitung"></label>
        <div class="total-line"><span>Upah lembur</span><span id="pay">-</span></div>
        <label class="field"><span>Keterangan / alasan</span><input type="text" name="reason" maxlength="200" value="${esc(a?.reason)}"></label>
        <div class="note info">Jika jam selesai lebih awal dari jam mulai, dianggap lewat tengah malam.</div>
        <button class="btn primary block" type="submit">Simpan</button>
      </form>`, {
      lock: true,
      onMount: (body, close) => {
        const f = body.querySelector('#f');
        const calc = () => {
          const min = overtimeMinutes(f.start.value, f.end.value);
          body.querySelector('#dur').textContent = min ? fmtDuration(min) : '-';
          body.querySelector('#pay').textContent = min && f.rate.value ? rupiah(overtimePay(min, f.rate.value)) : '-';
          return min;
        };
        f.addEventListener('input', calc);
        calc();
        f.addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = formData(f);
          if (!d.name || !d.date) return toast('Nama dan tanggal wajib diisi', 'err');
          if (!d.start || !d.end) return toast('Jam mulai dan selesai wajib diisi', 'err');
          const min = calc();
          if (!min) return toast('Jam mulai dan selesai tidak boleh sama', 'err');
          if (d.rate !== '' && !(Number(d.rate) >= 0)) return toast('Tarif tidak valid', 'err');
          if (min > 720 && !(await confirmDialog(`Durasi lembur ${fmtDuration(min)}. Sudah benar?`, { okText: 'Benar, simpan', danger: false }))) return;
          const dup = list.find((x) => x.id !== a?.id && x.date === d.date && x.name.toLowerCase() === d.name.toLowerCase());
          if (dup && !(await confirmDialog('Karyawan ini sudah punya catatan lembur di tanggal tersebut. Tetap tambahkan?', { okText: 'Tambahkan', danger: false }))) return;
          const rate = d.rate === '' ? null : Math.round(Number(d.rate));
          await db.put('overtime', { id: a?.id || db.uid(), name: d.name, date: d.date, start: d.start, end: d.end, minutes: min, rate, pay: rate ? overtimePay(min, rate) : 0, reason: d.reason, createdAt: a?.createdAt || Date.now(), updatedAt: Date.now() });
          st.month = d.date.slice(0, 7);
          close();
          toast('Lembur tersimpan');
          redraw();
        });
      },
    });
  }

  el.onclick = async (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = list.find((x) => x.id === b.dataset.id);
    if (b.dataset.action === 'add') form(null);
    if (b.dataset.action === 'edit' && a) form(a);
    if (b.dataset.action === 'del' && a && (await confirmDialog(`Hapus lembur ${a.name} tanggal ${fmtDate(a.date)}?`))) {
      await db.del('overtime', a.id);
      toast('Lembur dihapus');
      redraw();
    }
    if (b.dataset.action === 'csv') {
      downloadCSV(`lembur-${st.month}.csv`, toCSV([['Tanggal', 'Nama', 'Jam Mulai', 'Jam Selesai', 'Durasi (menit)', 'Durasi (jam)', 'Tarif per Jam', 'Upah Lembur', 'Keterangan'],
        ...inMonth().slice().reverse().map((x) => [x.date, x.name, x.start, x.end, x.minutes, +(x.minutes / 60).toFixed(2), x.rate ?? '', x.pay || 0, x.reason])]));
    }
  };
  el.onchange = (e) => {
    if (e.target.id === 'month' && e.target.value) { st.month = e.target.value; draw(); }
  };

  await load();
  draw();
}
