// Hoja SVG para láser: contorno de corte (rojo), letras (negro, para grabar) y pliegues (azul, discontinuo, para marcar). Medidas en mm.

const r3 = (n) => Math.round(n * 1000) / 1000;

export const SVG_DEFAULTS = { activa: null, colorCorte: "#ff0000", colorGrabado: "#000000", colorPliegue: "#0000ff", grosorLinea: 0.1, margen: 2, vista: false };

// Colores de la vista previa (cationes claros, aniones oscuros, como los dados impresos). No van al archivo descargado.
const VISTA = { cation: { cara: "#a9cde8", texto: "#1f2a33" }, anion: { cara: "#2a2d33", texto: "#ffffff" } };

const pathDe = (polys, dx, dy) => polys.map((pl) => "M" + pl.map(([x, y]) => `${r3(x + dx)} ${r3(y + dy)}`).join("L") + "Z").join("");
const lineas = (segs, dx, dy) => segs.map(([[x1, y1], [x2, y2]]) => `M${r3(x1 + dx)} ${r3(y1 + dy)}L${r3(x2 + dx)} ${r3(y2 + dy)}`).join("");

/** `h` = resultado de hoja(). Devuelve { w, h, inner }. `quitar` en la vista previa lleva data-dado y data-cara para poder vaciar una cara. */
export function construirSVG(h, o = {}) {
  const s = { ...SVG_DEFAULTS, ...o };
  const m = s.margen;
  const w = h.ancho + 2 * m, alto = h.alto + 2 * m;
  if (s.vista) {
    let v = "";
    h.dados.forEach((d) => {
      const c = VISTA[d.tipo], ox = d.dx + m, oy = d.dy + m;
      v += `<path d="${pathDe(d.dev.corte, ox, oy)}" fill="${d.dev.caras.some((x) => x.ion) ? c.cara : "#e9e9ee"}" stroke="#00000055" stroke-width="0.3" stroke-linejoin="round"/>`;
      v += `<path d="${lineas(d.dev.pliegues, ox, oy)}" fill="none" stroke="#00000044" stroke-width="0.25" stroke-dasharray="1.5 1"/>`;
      d.dev.caras.forEach((cara, ci) => {
        const activa = s.activa && s.activa.tipo === d.tipo && s.activa.cara === ci;
        v += `<g class="cara${activa ? " activa" : ""}" data-tipo="${d.tipo}" data-cara="${ci}">` +
             `<path d="${pathDe([cara.pol], ox, oy)}" fill="${activa ? "#ffffff55" : "transparent"}" stroke="${activa ? "#9a6bb4" : "none"}" stroke-width="0.9" stroke-linejoin="round"/>` +
             `<path d="${pathDe(cara.texto, ox, oy)}" fill="${c.texto}" fill-rule="evenodd" pointer-events="none"/></g>`;
      });
    });
    return { w, h: alto, inner: v };
  }
  let corte = "", grabado = "", pliegues = "";
  h.dados.forEach((d, di) => {
    const id = d.tipo === "anion" ? "aniones" : "cationes", ox = d.dx + s.margen, oy = d.dy + s.margen;
    corte += `<path id="corte-${id}" d="${pathDe(d.dev.corte, ox, oy)}"/>`;
    grabado += `<path id="texto-${id}" d="${pathDe(d.dev.caras.flatMap((c) => c.texto), ox, oy)}"/>`;
    if (d.dev.pliegues.length) pliegues += `<path id="pliegues-${id}" d="${lineas(d.dev.pliegues, ox, oy)}"/>`;
  });
  const inner =
    `<g id="grabado" fill="${s.colorGrabado}" fill-rule="evenodd" stroke="none">${grabado}</g>` +
    (pliegues ? `<g id="pliegues" fill="none" stroke="${s.colorPliegue}" stroke-width="${s.grosorLinea}" stroke-dasharray="2 1.5">${pliegues}</g>` : "") +
    `<g id="corte" fill="none" stroke="${s.colorCorte}" stroke-width="${s.grosorLinea}" stroke-linejoin="round">${corte}</g>`;
  return { w, h: alto, inner };
}

export function envolverSVG(w, h, inner, titulo = "") {
  const t = titulo ? `<title>${titulo.replace(/[<&>"]/g, "")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r3(w)}mm" height="${r3(h)}mm" viewBox="0 0 ${r3(w)} ${r3(h)}">${t}${inner}</svg>\n`;
}
