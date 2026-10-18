import { icon, toast, promptInstall } from '../util.js';

const ITEMS = [
  ['lembur', 'Lembur Karyawan', 'Catat jam lembur dan upahnya', 'clock'],
  ['reservasi', 'Reservasi', 'Pemesanan meja / acara', 'calendar'],
  ['belanja', 'Belanja', 'Pengeluaran operasional', 'cart'],
  ['pengaturan', 'Pengaturan Aplikasi', 'Profil usaha dan kategori', 'settings'],
  ['cadangan', 'Ekspor & Pencadangan Data', 'Cadangan JSON, impor, CSV', 'download'],
  ['info', 'Informasi Aplikasi', 'Versi, penyimpanan, bantuan', 'info'],
];

export default async function (el) {
  function draw() {
    const canInstall = !!window.__installEvt;
    el.innerHTML = `
      <div class="page-head"><h1>Lainnya</h1></div>
      ${ITEMS.map(([k, t, d, i]) => `<a class="link-row" href="#/${k}">${icon(i, 24).replace('class="ic"', 'class="ic lead"')}<div class="grow"><div class="t">${t}</div><div class="d">${d}</div></div>${icon('chevron', 18)}</a>`).join('')}
      ${canInstall ? `<button class="link-row" data-action="install">${icon('install', 24)}<div class="grow"><div class="t">Pasang di Layar Utama</div><div class="d">Pasang aplikasi seperti aplikasi biasa</div></div></button>` : ''}`;
  }
  el.onclick = async (e) => {
    if (e.target.closest('[data-action="install"]')) {
      if (await promptInstall()) toast('Aplikasi terpasang');
      draw();
    }
  };
  const onReady = () => { if (el.isConnected) draw(); };
  document.addEventListener('installready', onReady, { once: true });
  draw();
}
