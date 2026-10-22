// Texto de una cara del dado. Todo en milímetros, con el origen en el centro de la cara, x → derecha, y → ARRIBA.
// La fórmula va centrada con su carga en superíndice (Fe³⁺ se escribe «Fe» + «3+» pequeño y elevado) y, si se pide, el nombre debajo.

import { aplanar, caja } from "./geo.js";
import { cargaTexto, ROMANOS } from "./iones.js";

export const DEFAULTS = {
  caras: 6,          // número de caras del dado: 6 (cubo), 8 (octaedro) o 10 (decaedro)
  lado: 30,          // tamaño del dado (mm): arista del cubo, arista del octaedro o arista larga del decaedro
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
  q.caras = [6, 8, 10].includes(Number(q.caras)) ? Number(q.caras) : 6;
  q.lado = Math.min(120, Math.max(15, num(q.lado, DEFAULTS.lado)));
  q.tamanoTexto = Math.min(2, Math.max(0.5, num(q.tamanoTexto, 1)));
  q.mostrarNombre = !!q.mostrarNombre;
  q.profundidad = Math.min(Math.max(0.2, q.lado / 8), Math.max(0.2, num(q.profundidad, DEFAULTS.profundidad)));
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
 * Polígonos del texto de una cara, centrados en el origen de la cara (más `caja.cy`) y con la y hacia arriba.
 * `caja` = { w, h, cy }: el rectángulo en el que debe caber el texto (por defecto, el 80 % de la cara de un cubo).
 */
export function textoCara(fuente, ion, p, caja) {
  const q = sanear(p);
  const { w: ancho, h: alto, cy = 0, maxTam = 2 } = caja || { w: 0.8 * q.lado, h: 0.8 * q.lado, cy: 0 };
  const signo = fuente.charToGlyphIndex("−") > 0 ? "−" : "-";
  const ct = cargaTexto(ion, signo);
  const partes = trozos(ion.f);

  const medirFormula = (s) => partes.reduce((a, t) => a + fuente.getAdvanceWidth(t.txt, t.sub ? s * 0.6 : s), 0);
  const medirTodo = (s) => medirFormula(s) + s * 0.04 + fuente.getAdvanceWidth(ct, s * 0.5);

  const tam = Math.min(q.tamanoTexto, maxTam);   // en las caras pequeñas (triángulos, cometas) las letras no pueden crecer tanto
  let s = alto * 0.525 * tam;
  const maximo = ancho * 0.98;
  if (medirTodo(s) > maximo) s *= maximo / medirTodo(s);

  const polys = [];
  // la y crece hacia abajo en opentype: la línea base cae a 0,36 em por debajo del centro (mayúsculas ≈ 0,72 em); con nombre, sube un poco
  const base = (q.mostrarNombre ? -alto * 0.05 : 0) + s * 0.36;
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
    let ns = alto * 0.144 * Math.max(0.8, tam);
    const wn = fuente.getAdvanceWidth(nom, ns);
    if (wn > ancho * 0.98) ns *= (ancho * 0.98) / wn;
    polys.push(...aplanar(fuente.getPath(nom, -fuente.getAdvanceWidth(nom, ns) / 2, alto * 0.425, ns).commands));
  }
  // volcar la y (arriba positivo) y subir o bajar el bloque a su sitio en la cara
  return polys.map((pl) => pl.map(([px, py]) => [px, -py + cy]));
}

/** Caja del texto (para comprobar que cabe en la cara). */
export const cajaTexto = (polys) => caja(polys);
