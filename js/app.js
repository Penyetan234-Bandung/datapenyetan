import * as db from './db.js';
import { icon, toast, esc } from './util.js';

const routes = {
  beranda: () => import('./pages/home.js'),
  pesanan: () => import('./pages/orders.js'),
  menu: () => import('./pages/menu.js'),
  pelanggan: () => import('./pages/customers.js'),
  rangkuman: () => import('./pages/summary.js'),
  lainnya: () => import('./pages/more.js'),
  belanja: () => import('./pages/expenses.js'),
  lembur: () => import('./pages/overtime.js'),
  reservasi: () => import('./pages/reservations.js'),
  pengaturan: () => import('./pages/settings.js'),
  cadangan: () => import('./pages/backup.js'),
  info: () => import('./pages/info.js'),
};
const NAV = [
  ['beranda', 'Beranda', 'home'],
  ['pesanan', 'Pesanan', 'orders'],
  ['menu', 'Menu', 'menu'],
  ['pelanggan', 'Pelanggan', 'users'],
  ['rangkuman', 'Rangkuman', 'chart'],
  ['lainnya', 'Lainnya', 'grid'],
];
const SUB = new Set(['belanja', 'lembur', 'reservasi', 'pengaturan', 'cadangan', 'info']);

const nav = document.getElementById('nav');
nav.innerHTML = NAV.map(([k, l, i]) => `<a class="nav-item" href="#/${k}" data-k="${k}">${icon(i, 24)}<span>${l}</span></a>`).join('');

let token = 0;
async function render() {
  const my = ++token;
  let name = (location.hash.replace(/^#\/?/, '') || 'beranda').split('?')[0];
  if (name === 'absensi') name = 'lembur'; // tautan lama
  const key = routes[name] ? name : 'beranda';
  const active = SUB.has(key) ? 'lainnya' : key;
  nav.querySelectorAll('.nav-item').forEach((a) => {
    const on = a.dataset.k === active;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const view = document.getElementById('view');
  try {
    const mod = await routes[key]();
    if (my !== token) return;
    view.innerHTML = '';
    view.onclick = view.oninput = view.onchange = view.onsubmit = null;
    window.scrollTo(0, 0);
    await mod.default(view);
  } catch (err) {
    console.error(err);
    if (my === token) {
      view.innerHTML = `<div class="empty"><div class="empty-title">Terjadi kesalahan</div><p>${esc(err.message || err)}</p></div>`;
    }
  }
}

/* Indikator offline */
function syncOnline() {
  document.getElementById('offline').hidden = navigator.onLine;
}
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();

/* Instalasi PWA */
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installEvt = e;
  document.dispatchEvent(new Event('installready'));
});
window.addEventListener('appinstalled', () => {
  window.__installEvt = null;
  toast('Aplikasi terpasang di layar utama');
});

/* Service worker + mekanisme pembaruan */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then((reg) => {
    const showUpdate = (worker) => {
      const bar = document.getElementById('update-bar');
      bar.hidden = false;
      document.getElementById('update-btn').onclick = () => worker.postMessage('SKIP_WAITING');
    };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((e) => console.warn('SW gagal didaftarkan', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

async function boot() {
  try {
    await db.open();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) {
    document.getElementById('view').innerHTML = `<div class="empty"><div class="empty-title">Penyimpanan tidak tersedia</div><p>${esc(e.message)}. Coba buka di Chrome (bukan mode penyamaran).</p></div>`;
    return;
  }
  window.addEventListener('hashchange', render);
  registerSW();
  render();
}
boot();
