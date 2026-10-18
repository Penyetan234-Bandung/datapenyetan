import { toast, pageHeader, promptInstall } from '../util.js';

export default async function (el) {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function draw() {
    el.innerHTML = `
      ${pageHeader('Informasi Aplikasi', { back: '#/lainnya' })}
      <div class="card"><h3>Penyetan 234</h3>
        <dl class="kv"><dt>Versi</dt><dd>1.0.0</dd><dt>Mode</dt><dd>${standalone ? 'Terpasang (standalone)' : 'Browser'}</dd><dt>Koneksi</dt><dd>${navigator.onLine ? 'Online' : 'Offline'}</dd><dt>Penyimpanan</dt><dd>IndexedDB di perangkat ini</dd></dl></div>
      ${window.__installEvt ? '<button class="btn primary block" data-a="install" style="margin-bottom:10px">Pasang di Layar Utama</button>' : ''}
      <div class="card"><b>Cara memasang di Android</b><ol style="padding-left:20px;margin:8px 0 0"><li>Buka alamat aplikasi di Chrome.</li><li>Ketuk menu ⋮ → <b>Instal aplikasi</b> / <b>Tambahkan ke layar utama</b>.</li><li>Buka dari ikon Penyetan 234 di layar utama.</li></ol></div>
      <div class="note info"><b>Penting:</b> data hanya ada di HP ini dan tidak otomatis tersinkron ke perangkat lain. Pakai menu Ekspor &amp; Pencadangan secara rutin. Sinkronisasi banyak perangkat membutuhkan layanan online (mis. Firebase) yang belum diaktifkan di versi ini.</div>`;
  }
  el.onclick = async (e) => {
    if (e.target.closest('[data-a="install"]')) { if (await promptInstall()) toast('Aplikasi terpasang'); draw(); }
  };
  draw();
}
