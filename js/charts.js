// Grafik batang SVG ringan (tanpa library, tetap jalan offline).
import { compact, rupiah } from './calc.js';
import { esc } from './util.js';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/* data: [{label, value}] */
export function barChart(data, color = '#10B981') {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!data.length || total <= 0) return '<div class="chart-empty">Belum ada data pada periode ini</div>';
  const W = 320, H = 170, L = 8, R = 8, T = 18, B = 24;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const bw = (W - L - R) / data.length;
  const bars = data.map((d, i) => {
    const h = ((H - T - B) * d.value) / max;
    const x = L + i * bw + bw * 0.18;
    const w = bw * 0.64;
    const y = H - B - h;
    return `<g><title>${esc(d.label)}: ${rupiah(d.value)}</title>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, d.value > 0 ? 2 : 0).toFixed(1)}" rx="3" fill="${color}"/>
      ${d.value > 0 ? `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="ct">${compact(d.value)}</text>` : ''}
      <text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="cl">${esc(d.label)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Grafik batang"><line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#E2E8F0"/>${bars}</svg>
    <div class="chart-total">Total: <b>${rupiah(total)}</b></div>`;
}

/* rows: [{label, income, expense}] */
export function groupedChart(rows) {
  const tot = rows.reduce((s, r) => s + r.income + r.expense, 0);
  if (!rows.length || tot <= 0) return '<div class="chart-empty">Belum ada data pada periode ini</div>';
  const slot = 34, H = 190, T = 18, B = 26, L = 6;
  const W = Math.max(320, L * 2 + rows.length * slot);
  const max = niceMax(Math.max(...rows.flatMap((r) => [r.income, r.expense])));
  const bar = (v, x, w, c, name, label) => {
    const h = ((H - T - B) * v) / max;
    const y = H - B - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${Math.max(h, v > 0 ? 2 : 0).toFixed(1)}" rx="2" fill="${c}"><title>${esc(label)} ${name}: ${rupiah(v)}</title></rect>`;
  };
  const g = rows.map((r, i) => {
    const x0 = L + i * slot + 4;
    return `${bar(r.income, x0, 12, '#10B981', 'Uang masuk', r.label)}${bar(r.expense, x0 + 13, 12, '#F43F5E', 'Belanja', r.label)}
      <text x="${(x0 + 12.5).toFixed(1)}" y="${H - 9}" text-anchor="middle" class="cl">${esc(r.label)}</text>`;
  }).join('');
  return `<div class="chart-scroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" class="chart wide" role="img" aria-label="Grafik pemasukan dan pengeluaran"><line x1="${L}" y1="${H - B}" x2="${W - L}" y2="${H - B}" stroke="#E2E8F0"/>${g}</svg></div>
    <div class="legend"><span><i style="background:#10B981"></i>Uang masuk</span><span><i style="background:#F43F5E"></i>Belanja</span><span class="muted">Skala maks ${compact(max)}</span></div>`;
}
