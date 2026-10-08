// Gráficos ligeros sin dependencias: barras horizontales (HTML/CSS) y
// dona (SVG). Reciben datos ya calculados y devuelven HTML.

function escAttr(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

export const CHART_COLORS = ["#2e6f9e", "#3fa796", "#d98324", "#8a5cd1", "#1f3864", "#c0557a"];

/**
 * Barras horizontales. data: [{ label, value, color? }].
 * @param {Array<{label:string, value:number, color?:string}>} data
 * @param {{unit?:string, decimals?:number}} [opts]
 */
export function barList(data, opts = {}) {
  const unit = opts.unit || "";
  const dec = opts.decimals ?? 0;
  const max = Math.max(1, ...data.map((d) => d.value));
  const rows = data
    .map((d, i) => {
      const pct = Math.max(2, (d.value / max) * 100);
      const color = d.color || CHART_COLORS[i % CHART_COLORS.length];
      return (
        `<div class="bar-row">` +
        `<span class="bar-label" title="${escAttr(d.label)}">${escAttr(d.label)}</span>` +
        `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>` +
        `<span class="bar-val">${Number(d.value).toFixed(dec)}${unit}</span>` +
        `</div>`
      );
    })
    .join("");
  return `<div class="bars">${rows}</div>`;
}

/**
 * Dona SVG con leyenda. segments: [{ label, value, color }].
 * @param {Array<{label:string, value:number, color:string}>} segments
 * @param {{centerLabel?:string, centerValue?:string|number}} [opts]
 */
export function donut(segments, opts = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = 70;
  const cy = 70;
  const r = 52;
  const sw = 20;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments
    .map((s) => {
      const len = (s.value / total) * c;
      const el =
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}" ` +
        `stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" ` +
        `transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return el;
    })
    .join("");
  const centerVal = opts.centerValue != null ? opts.centerValue : total;
  const centerLbl = opts.centerLabel || "";
  const legend = segments
    .map(
      (s) =>
        `<li><span class="dotc" style="background:${s.color}"></span>${escAttr(s.label)}<b>${s.value}</b></li>`
    )
    .join("");
  return (
    `<div class="donutwrap">` +
    `<svg class="donut" viewBox="0 0 140 140" width="140" height="140" role="img">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${sw}"/>` +
    arcs +
    `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="donut-num">${centerVal}</text>` +
    `<text x="${cx}" y="${cy + 15}" text-anchor="middle" class="donut-lbl">${escAttr(centerLbl)}</text>` +
    `</svg>` +
    `<ul class="legend">${legend}</ul>` +
    `</div>`
  );
}

/** Tarjeta contenedora de un gráfico. */
export function chartCard(title, bodyHTML, iconHTML = "") {
  return `<div class="chartcard"><h3 class="chart-title">${iconHTML} ${title}</h3>${bodyHTML}</div>`;
}

/**
 * Gráfico de línea para una métrica a lo largo de varias semanas.
 * @param {Array<{label:string, value:number}>} points
 * @param {{unit?:string, decimals?:number, color?:string}} [opts]
 */
export function lineChart(points, opts = {}) {
  const unit = opts.unit || "";
  const dec = opts.decimals ?? 0;
  const color = opts.color || "#2e6f9e";
  const w = 340;
  const h = 130;
  const padX = 30;
  const padY = 22;
  const max = Math.max(1, ...points.map((p) => p.value));
  const n = points.length;
  const x = (i) => (n <= 1 ? w / 2 : padX + (i * (w - 2 * padX)) / (n - 1));
  const y = (v) => h - padY - (v / max) * (h - 2 * padY);
  const poly = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const dots = points
    .map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" fill="${color}"/>`)
    .join("");
  const vals = points
    .map(
      (p, i) =>
        `<text x="${x(i).toFixed(1)}" y="${(y(p.value) - 8).toFixed(1)}" text-anchor="middle" class="axis-val">${Number(p.value).toFixed(dec)}${unit}</text>`
    )
    .join("");
  const labels = points
    .map((p, i) => `<text x="${x(i).toFixed(1)}" y="${h - 4}" text-anchor="middle" class="axis">${escAttr(p.label)}</text>`)
    .join("");
  return (
    `<svg class="linechart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMidYMid meet">` +
    `<polyline points="${poly}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>` +
    dots +
    vals +
    labels +
    `</svg>`
  );
}
