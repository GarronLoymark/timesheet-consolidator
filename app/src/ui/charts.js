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
