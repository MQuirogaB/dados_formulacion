// Texto de una cara del dado. Todo en milímetros, con el origen en el centro de la cara, x → derecha, y → ARRIBA.
// La fórmula va centrada con su carga en superíndice (Fe³⁺ se escribe «Fe» + «3+» pequeño y elevado) y, si se pide, el nombre debajo.

import { aplanar, caja } from "./geo.js";
import { cargaTexto, ROMANOS } from "./iones.js";

export const DEFAULTS = {
  lado: 30,          // arista del cubo (mm)
  tamanoTexto: 1,    // factor para agrandar o reducir las letras
  mostrarNombre: false,
  profundidad: 0.8,  // profundidad del texto hundido / altura del relieve en 3D (mm)
  modoTexto: "hundido", // "hundido" | "relieve" | "incrustado"
  solapas: true,     // solapas de pegado en el desarrollo
  pliegues: true,    // líneas de plegado en el desarrollo
  separacion: 8,     // espacio entre desarrollos en la hoja (mm)
};

const num = (v, d) => (Number.isFinite(v) ? v : d);
export const MODOS = ["hundido", "relieve", "incrustado"];

export function sanear(p = {}) {
  const q = { ...DEFAULTS, ...p };
  q.lado = Math.min(80, Math.max(15, num(q.lado, DEFAULTS.lado)));
  q.tamanoTexto = Math.min(2, Math.max(0.5, num(q.tamanoTexto, 1)));
  q.mostrarNombre = !!q.mostrarNombre;
  q.profundidad = Math.min(Math.max(0.2, q.lado / 4), Math.max(0.2, num(q.profundidad, DEFAULTS.profundidad)));
  q.modoTexto = MODOS.includes(q.modoTexto) ? q.modoTexto : "hundido";
  q.solapas = !!q.solapas;
  q.pliegues = !!q.pliegues;
  q.separacion = Math.min(40, Math.max(2, num(q.separacion, DEFAULTS.separacion)));
  return q;
}

/** Nombre del ion para ponerlo bajo la fórmula: «Hierro(III)», «Cloruro»… */
export function nombreIon(ion) {
  const n = ion.carga > 0 ? (ion.variable ? `${ion.elem}(${ROMANOS[ion.carga]})` : ion.elem) : ion.nombre;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Trozos de una fórmula: letras normales y dígitos como subíndice. */
function trozos(formula) {
  const out = [];
  for (const m of formula.matchAll(/(\d+)|([^\d]+)/g)) out.push({ txt: m[0], sub: !!m[1] });
  return out;
}

/**
 * Polígonos del texto de una cara (sin unir), centrados en (0, 0) y con la y hacia arriba.
 * La y de opentype va hacia abajo, así que se vuelca al final.
 */
export function textoCara(fuente, ion, p) {
  const q = sanear(p);
  const L = q.lado, margen = L * 0.1, ancho = L - 2 * margen;
  const signo = fuente.charToGlyphIndex("−") > 0 ? "−" : "-";
  const ct = cargaTexto(ion, signo);
  const partes = trozos(ion.f);

  const medirFormula = (s) => partes.reduce((a, t) => a + fuente.getAdvanceWidth(t.txt, t.sub ? s * 0.6 : s), 0);
  const medirTodo = (s) => medirFormula(s) + s * 0.04 + fuente.getAdvanceWidth(ct, s * 0.5);

  let s = L * 0.42 * q.tamanoTexto;
  const maximo = ancho * 0.98;
  if (medirTodo(s) > maximo) s *= maximo / medirTodo(s);

  const polys = [];
  // la y crece hacia abajo en opentype: la línea base cae a 0,36 em por debajo del centro (mayúsculas ≈ 0,72 em); con nombre, sube un poco
  const base = (q.mostrarNombre ? -L * 0.04 : 0) + s * 0.36;
  let x = -medirTodo(s) / 2;
  for (const t of partes) {
    const sz = t.sub ? s * 0.6 : s;
    polys.push(...aplanar(fuente.getPath(t.txt, x, t.sub ? base + s * 0.16 : base, sz).commands));
    x += fuente.getAdvanceWidth(t.txt, sz);
  }
  x += s * 0.04;
  polys.push(...aplanar(fuente.getPath(ct, x, base - s * 0.42, s * 0.5).commands));

  if (q.mostrarNombre) {
    const nom = nombreIon(ion);
    let ns = L * 0.115 * Math.max(0.8, q.tamanoTexto);
    const w = fuente.getAdvanceWidth(nom, ns);
    if (w > ancho) ns *= ancho / w;
    polys.push(...aplanar(fuente.getPath(nom, -fuente.getAdvanceWidth(nom, ns) / 2, L * 0.34, ns).commands));
  }
  // volcar la y y centrar el bloque de texto en horizontal
  return polys.map((pl) => pl.map(([px, py]) => [px, -py]));
}

/** Caja del texto (para comprobar que cabe en la cara). */
export const cajaTexto = (polys) => caja(polys);
