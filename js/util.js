// Helper UI: escape HTML, ikon, sheet/modal, konfirmasi, toast, unduhan.
export { rupiah, fmtDate, todayStr, compact } from './calc.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICONS = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  orders: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  menu: '<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M17 3c-2 2-3 5-3 8h3v10"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  install: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
};

export function icon(name, size = 22) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function pageHeader(title, { back = '', actions = '' } = {}) {
  return `<div class="page-head">${back ? `<a class="icon-btn" href="${back}" aria-label="Kembali">${icon('back')}</a>` : ''}<h1>${esc(title)}</h1><div class="head-actions">${actions}</div></div>`;
}

export function emptyState(title, text = '') {
  return `<div class="empty"><div class="empty-title">${esc(title)}</div>${text ? `<p>${esc(text)}</p>` : ''}</div>`;
}

export function fab(label = 'Tambah') {
  return `<button class="fab" data-action="add" aria-label="${esc(label)}">${icon('plus', 28)}</button>`;
}

/* Sheet (panel dari bawah). lock=true: tidak menutup saat area luar diketuk (untuk formulir). */
export function openSheet(title, html, { onMount, lock = false } = {}) {
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Tutup" type="button">✕</button></div><div class="sheet-body">${html}</div></div>`;
  root.appendChild(wrap);
  document.body.classList.add('noscroll');
  const close = () => {
    wrap.remove();
    if (!root.children.length) document.body.classList.remove('noscroll');
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || (!lock && e.target === wrap)) close();
  });
  const body = wrap.querySelector('.sheet-body');
  if (onMount) onMount(body, close);
  return { close, body };
}

export function confirmDialog(message, { okText = 'Hapus', danger = true, title = 'Konfirmasi' } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('sheet-root');
    const wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop center';
    wrap.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true"><h3>${esc(title)}</h3><p>${esc(message)}</p><div class="dialog-actions"><button class="btn ghost" data-v="0" type="button">Batal</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1" type="button">${esc(okText)}</button></div></div>`;
    root.appendChild(wrap);
    document.body.classList.add('noscroll');
    const done = (v) => {
      wrap.remove();
      if (!root.children.length) document.body.classList.remove('noscroll');
      resolve(v);
    };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target === wrap) done(false);
    });
  });
}

let toastTimer;
export function toast(msg, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2600);
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadCSV(filename, csvText) {
  downloadText(filename, '﻿' + csvText, 'text/csv;charset=utf-8');
  toast('Berkas CSV diunduh');
}

export function formData(root) {
  const o = {};
  new FormData(root).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
  return o;
}

export function options(list, selected = '') {
  return list.map((v) => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

export async function promptInstall() {
  const evt = window.__installEvt;
  if (!evt) return false;
  evt.prompt();
  const res = await evt.userChoice;
  window.__installEvt = null;
  return res.outcome === 'accepted';
}
