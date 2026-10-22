// Geometría del dado: las seis caras, su desarrollo plano en cruz y la colocación de los textos.
//
// Desarrollo (cada cuadro mide «lado»; las columnas y filas cuentan desde la esquina de arriba a la izquierda):
//
//           [arriba]
//   [izq] [frente] [der] [fondo]
//           [abajo]
//
// Plegado: «frente» mira hacia ti, «arriba» queda encima y los textos se leen derechos en cada cara tal como se ven en el desarrollo.

import { textoCara, sanear } from "./cara.js";
import { union } from "./geo.js";

// Para cada cara: posición en el desarrollo y ejes en el espacio 3D (x → derecha, y → hacia el fondo, z → arriba):
// n = normal hacia fuera, r = «derecha» del texto, u = «arriba» del texto. Siempre r × u = n.
export const CARAS = [
  { id: "izq",    col: 0, fila: 1, n: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] },
  { id: "frente", col: 1, fila: 1, n: [0, -1, 0], r: [1, 0, 0],  u: [0, 0, 1] },
  { id: "der",    col: 2, fila: 1, n: [1, 0, 0],  r: [0, 1, 0],  u: [0, 0, 1] },
  { id: "fondo",  col: 3, fila: 1, n: [0, 1, 0],  r: [-1, 0, 0], u: [0, 0, 1] },
  { id: "arriba", col: 1, fila: 0, n: [0, 0, 1],  r: [1, 0, 0],  u: [0, 1, 0] },
  { id: "abajo",  col: 1, fila: 2, n: [0, 0, -1], r: [1, 0, 0],  u: [0, -1, 0] },
];

// Solapas de pegado: (x0, y0) → (x1, y1) en cuadros de «lado», y hacia dónde salen. Cada una une una de las 7 costuras del cubo.
const SOLAPAS = [
  [1, 0, 1, 1, -1, 0], [2, 0, 2, 1, 1, 0], [1, 0, 2, 0, 0, -1],   // arriba: izquierda, derecha, arriba
  [1, 2, 1, 3, -1, 0], [2, 2, 2, 3, 1, 0], [1, 3, 2, 3, 0, 1],    // abajo: izquierda, derecha, abajo
  [4, 1, 4, 2, 1, 0],                                              // fondo: derecha (se pega con el borde izquierdo de «izq»)
];

// Pliegues entre caras (bisagras del desarrollo), también en cuadros de «lado».
const BISAGRAS = [[1, 1, 1, 2], [2, 1, 2, 2], [3, 1, 3, 2], [1, 1, 2, 1], [1, 2, 2, 2]];

function solapa(L, [x0, y0, x1, y1, dx, dy]) {
  const A = [x0 * L, y0 * L], B = [x1 * L, y1 * L];
  const t = L * 0.22, c = t * 0.7;
  const e = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  return [A, [A[0] + dx * t + e[0] * c, A[1] + dy * t + e[1] * c], [B[0] + dx * t - e[0] * c, B[1] + dy * t - e[1] * c], B];
}

/**
 * Desarrollo plano de un dado. `ions`: lista de 6 iones (o null en las caras vacías), en el orden de CARAS.
 * Devuelve las coordenadas SVG (y hacia abajo) con el origen en la esquina de arriba a la izquierda del cuadro «izq» (0, 0 = fila 0, col 0).
 * Sale { caras: [{ ion, texto }], corte, pliegues, caja }.
 */
export function desarrollo(C, fuente, ions, p) {
  const q = sanear(p);
  const L = q.lado;
  const cache = new Map();
  const caras = CARAS.map((cara, i) => {
    const ion = ions[i] || null;
    let texto = [];
    if (ion) {
      if (!cache.has(ion.id)) cache.set(ion.id, textoCara(fuente, ion, q));
      texto = cache.get(ion.id).map((pl) => pl.map(([x, y]) => [(cara.col + 0.5) * L + x, (cara.fila + 0.5) * L - y]));
    }
    return { ion, texto, cara };
  });
  const cuadros = CARAS.map((c) => [[c.col * L, c.fila * L], [(c.col + 1) * L, c.fila * L], [(c.col + 1) * L, (c.fila + 1) * L], [c.col * L, (c.fila + 1) * L]]);
  const tabs = q.solapas ? SOLAPAS.map((s) => solapa(L, s)) : [];
  const corte = union(C, cuadros, tabs.length ? tabs : undefined);
  const pliegues = BISAGRAS.map(([a, b, c, d]) => [[a * L, b * L], [c * L, d * L]]);
  if (q.solapas) for (const s of SOLAPAS) pliegues.push([[s[0] * L, s[1] * L], [s[2] * L, s[3] * L]]);
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const pl of corte) for (const [x, y] of pl) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  return { caras, corte, pliegues, caja: { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 } };
}

/** Coloca varios desarrollos uno debajo de otro. `dados` = [{ tipo, ions }]. */
export function hoja(C, fuente, dados, p) {
  const q = sanear(p);
  let y = 0, ancho = 0;
  const out = [];
  for (const d of dados) {
    const dev = desarrollo(C, fuente, d.ions, q);
    const dx = -dev.caja.x1, dy = y - dev.caja.y1;
    out.push({ ...d, dev, dx, dy });
    y += dev.caja.h + q.separacion;
    ancho = Math.max(ancho, dev.caja.w);
  }
  return { dados: out, lado: q.lado, ancho, alto: Math.max(0, y - q.separacion) };
}
