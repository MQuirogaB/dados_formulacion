// Poliedros para los dados: cubo (6 caras), octaedro (8 triángulos) y trapezoedro pentagonal (10 cometas).
// Cada cara lleva su sistema de ejes para el texto: n = normal hacia fuera, r = «derecha» del texto, u = «arriba» (r × u = n),
// el origen del texto, el contorno en coordenadas locales (x → r, y → u) y la caja donde cabe el texto.
// Los desarrollos planos (árboles de despliegue) se buscaron con scripts/desarrollos.mjs y se guardan aquí.

import { union, interseccion, areaTotal, areaFirmada } from "./geo.js";

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norma = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / norma(a));
const centro = (vs) => mul(vs.reduce(add, [0, 0, 0]), 1 / vs.length);

export const TIPOS = [6, 8, 10];
export const LADO_POR_DEFECTO = { 6: 30, 8: 45, 10: 45 };
export const NOMBRE_DADO = { 6: "cubo (6 caras)", 8: "octaedro (8 caras)", 10: "decaedro (10 caras)" };

/** Cara a partir de sus vértices (en sentido antihorario visto desde fuera) y de su vértice «de arriba». */
function cara(verts, iArriba, { origen, caja } = {}) {
  const o = origen || centro(verts);
  let n = unit(cross(sub(verts[1], verts[0]), sub(verts[2], verts[0])));
  const u = unit(sub(verts[iArriba], o));
  const uu = unit(sub(u, mul(n, dot(u, n))));
  const r = unit(cross(uu, n));
  return { verts, n, r, u: uu, origen: o, anillo: verts.map((v) => [dot(sub(v, o), r), dot(sub(v, o), uu)]), caja };
}

// Cubo: caras en el orden del desarrollo en cruz. Los ejes del texto son los que hacen que se lea derecho al plegar la cruz.
const EJES_CUBO = [
  { n: [-1, 0, 0], r: [0, -1, 0], u: [0, 0, 1] },
  { n: [0, -1, 0], r: [1, 0, 0], u: [0, 0, 1] },
  { n: [1, 0, 0], r: [0, 1, 0], u: [0, 0, 1] },
  { n: [0, 1, 0], r: [-1, 0, 0], u: [0, 0, 1] },
  { n: [0, 0, 1], r: [1, 0, 0], u: [0, 1, 0] },
  { n: [0, 0, -1], r: [1, 0, 0], u: [0, -1, 0] },
];

function cubo(L) {
  const a = L / 2, c = [a, a, a];
  return EJES_CUBO.map(({ n, r, u }) => {
    const o = add(c, mul(n, a));
    const vs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => add(o, add(mul(r, x * a), mul(u, y * a))));
    return { verts: vs, n, r, u, origen: o, anillo: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x * a, y * a]), caja: { w: 0.8 * L, h: 0.8 * L, cy: 0 } };
  });
}

function octaedro(a) {
  const R = a / Math.SQRT2;
  const P = { "+x": [R, 0, 0], "-x": [-R, 0, 0], "+y": [0, R, 0], "-y": [0, -R, 0], "+z": [0, 0, R], "-z": [0, 0, -R] };
  const signos = [[1, 1, 1], [-1, 1, 1], [-1, -1, 1], [1, -1, 1], [1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1]];
  return signos.map(([sx, sy, sz]) => {
    let vs = [P[sx > 0 ? "+x" : "-x"], P[sy > 0 ? "+y" : "-y"], P[sz > 0 ? "+z" : "-z"]];
    const n = cross(sub(vs[1], vs[0]), sub(vs[2], vs[0]));
    if (dot(n, centro(vs)) < 0) vs = [vs[0], vs[2], vs[1]];
    // el vértice de arriba: el más alto; si hay empate, el primero (en las caras de abajo, dos vértices están a la misma altura)
    let ia = 0;
    vs.forEach((v, i) => { if (v[2] > vs[ia][2] + 1e-9) ia = i; });
    // altura del triángulo = 0,866 a; el texto se centra a 0,26 a de la base y el centroide está a 0,2887 a
    return cara(vs, ia, { caja: { w: 0.52 * a, h: 0.28 * a, cy: -0.029 * a, maxTam: 1.25 } });
  });
}

// Trapezoedro pentagonal: dos vértices en los polos y diez en una «corona» en zigzag; las diez caras son cometas planos.
// Con el polo a altura 1 y la corona a ±ZR, los cuatro vértices de cada cara son coplanares (ZR = 0,19098 / 1,80902 ≈ 0,10557).
const COS36 = Math.cos(Math.PI / 5);
const ZR = (1 - COS36) / (1 + COS36);
const LARGO_ARISTA_10 = Math.sqrt(1 + (1 - ZR) ** 2);   // arista larga (del polo a la corona), en unidades de polo

function decaedro(lado) {
  const s = lado / LARGO_ARISTA_10;
  const T = [0, 0, s], B = [0, 0, -s];
  const R = (k) => { k = ((k % 10) + 10) % 10; const t = (k * Math.PI) / 5; return [s * Math.cos(t), s * Math.sin(t), s * ZR * (k % 2 ? -1 : 1)]; };
  const caras = [];
  const hace = (apice, vs) => {
    let v = [apice, ...vs];
    const n = cross(sub(v[1], v[0]), sub(v[2], v[0]));
    if (dot(n, centro(v)) < 0) v = [v[0], v[3], v[2], v[1]];
    const opuesto = v[2];  // el vértice contrario al polo está en el eje del cometa
    const t = 0.64;
    const origen = add(v[0], mul(sub(opuesto, v[0]), t));
    caras.push(cara(v, 0, { origen, caja: { w: 0.74 * s, h: 0.42 * s, cy: 0, maxTam: 1.3 } }));
  };
  for (let i = 0; i < 5; i++) hace(T, [R(2 * i), R(2 * i + 1), R(2 * i + 2)]);
  for (let i = 0; i < 5; i++) hace(B, [R(2 * i + 1), R(2 * i + 2), R(2 * i + 3)]);
  return caras;
}

/** Caras de un dado de `n` caras (6, 8 o 10) con el tamaño `lado` (mm): arista del cubo, arista del octaedro o arista larga del decaedro. */
export function poliedro(n, lado) {
  const caras = n === 8 ? octaedro(lado) : n === 10 ? decaedro(lado) : cubo(lado);
  return { n: caras.length, lado, caras };
}

// ---------------------------------------------------------------------
// Desarrollo plano
// ---------------------------------------------------------------------

const claveV = (v) => v.map((x) => Math.round(x * 1e4)).join(",");

/** Aristas compartidas entre caras: [{ a, b, i, j }] con los vértices (índices en cada cara) de la arista. */
export function adyacencias(poli) {
  const mapa = new Map();
  poli.caras.forEach((c, i) => c.verts.forEach((v, k) => {
    const w = c.verts[(k + 1) % c.verts.length];
    const clave = [claveV(v), claveV(w)].sort().join("|");
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push({ cara: i, k });
  }));
  return [...mapa.values()].filter((l) => l.length === 2);
}

// Coordenadas de una cara en el plano del dibujo (SVG: y hacia abajo): (x, y) local → (x, −y)
const aSvg = (anillo) => anillo.map(([x, y]) => [x, -y]);

/** Transformación rígida (giro + traslación) que lleva el segmento p0→p1 al segmento q0→q1. */
function rigida(p0, p1, q0, q1) {
  const ang = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]) - Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const c = Math.cos(ang), s = Math.sin(ang);
  const t = [q0[0] - (c * p0[0] - s * p0[1]), q0[1] - (s * p0[0] + c * p0[1])];
  return { c, s, t };
}
export const aplicar = (T, [x, y]) => [T.c * x - T.s * y + T.t[0], T.s * x + T.c * y + T.t[1]];
const compone = (T, S) => ({ // T ∘ S
  c: T.c * S.c - T.s * S.s, s: T.s * S.c + T.c * S.s,
  t: [T.c * S.t[0] - T.s * S.t[1] + T.t[0], T.s * S.t[0] + T.c * S.t[1] + T.t[1]],
});

/**
 * Despliega el poliedro siguiendo un árbol: lista de [cara, padre] (la raíz lleva padre −1) en un orden en que el padre va antes.
 * Devuelve por cada cara su transformación local→plano y su contorno en el plano.
 */
export function desplegar(poli, arbol) {
  const ady = adyacencias(poli);
  const T = new Array(poli.n), pol = new Array(poli.n);
  const local = poli.caras.map((c) => aSvg(c.anillo));
  for (const [i, padre] of arbol) {
    if (padre < 0) T[i] = { c: 1, s: 0, t: [0, 0] };
    else {
      const e = ady.find((l) => (l[0].cara === i && l[1].cara === padre) || (l[1].cara === i && l[0].cara === padre));
      const [mio, suyo] = e[0].cara === i ? [e[0], e[1]] : [e[1], e[0]];
      const nm = poli.caras[i].verts.length, np = poli.caras[padre].verts.length;
      // el vértice mio.k → mio.k+1 de la cara coincide con suyo.k+1 → suyo.k de la padre (se recorren en sentidos opuestos)
      const p0 = local[i][mio.k], p1 = local[i][(mio.k + 1) % nm];
      const q0 = pol[padre][(suyo.k + 1) % np], q1 = pol[padre][suyo.k];
      T[i] = rigida(p0, p1, q0, q1);
    }
    pol[i] = local[i].map((p) => aplicar(T[i], p));
  }
  return { T, pol, ady };
}

const hayChoque = (C, a, b) => areaTotal(interseccion(C, [a], [b])) > 0.01;

/** ¿Algún par de caras del desarrollo se solapa? */
export function solapadas(C, pol) {
  for (let i = 0; i < pol.length; i++) for (let j = i + 1; j < pol.length; j++) if (hayChoque(C, pol[i], pol[j])) return [i, j];
  return null;
}

/** Solapa trapezoidal sobre la arista a→b (en el plano), saliendo hacia el lado opuesto al punto `dentro`. */
function solapa(a, b, dentro, f) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
  const e = [dx / l, dy / l];
  let nx = -e[1], ny = e[0];
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  if ((dentro[0] - mx) * nx + (dentro[1] - my) * ny > 0) { nx = -nx; ny = -ny; }
  const t = Math.min(0.22 * l, 0.22 * 30) * f * (l >= 12 ? 1 : 0.8), c = t * 0.7;
  return [a, [a[0] + nx * t + e[0] * c, a[1] + ny * t + e[1] * c], [b[0] + nx * t - e[0] * c, b[1] + ny * t - e[1] * c], b];
}

/**
 * Coloca una solapa en cada costura (arista que no es bisagra del árbol), en el lado donde no choque con nada.
 * Devuelve { solapas, sinSolapa } (sinSolapa: costuras sin sitio para la solapa).
 */
export function colocarSolapas(C, poli, des, arbol) {
  const bisagras = new Set(arbol.filter(([, p]) => p >= 0).map(([i, p]) => [Math.min(i, p), Math.max(i, p)].join()));
  const solapas = [], sinSolapa = [];
  const ocupado = [...des.pol];
  for (const l of des.ady) {
    const [x, y] = l;
    if (bisagras.has([Math.min(x.cara, y.cara), Math.max(x.cara, y.cara)].join())) continue;
    let puesta = false;
    for (const factor of [1, 0.8, 0.6, 0.45, 0.3]) {
      for (const lado of [x, y]) {
        const pol = des.pol[lado.cara], n = pol.length;
        const a = pol[lado.k], b = pol[(lado.k + 1) % n];
        const centroPol = [pol.reduce((s, p) => s + p[0], 0) / n, pol.reduce((s, p) => s + p[1], 0) / n];
        const tab = solapa(a, b, centroPol, factor);
        const roza = ocupado.some((o) => hayChoque(C, tab, o));
        if (!roza) { solapas.push({ poly: tab, cara: lado.cara, k: lado.k }); ocupado.push(tab); puesta = true; break; }
      }
      if (puesta) break;
    }
    if (!puesta) sinSolapa.push(l);
  }
  return { solapas, sinSolapa };
}

// Todos los polígonos con el mismo sentido de giro: con sentidos mezclados Clipper no fusiona las piezas que solo comparten una arista.
const orientado = (p) => (areaFirmada(p) < 0 ? [...p].reverse() : p);
// (Con una solapa que roza el vértice de otra cara, Clipper deja a veces esa cara suelta tras la primera unión: se repite la unión.)
export const contornoUnido = (C, des, solapas) => union(C, union(C, des.pol.map(orientado), solapas.length ? solapas.map((s) => orientado(s.poly)) : undefined));
export const cajaDe = (polys) => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; }
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
};

// Árboles de despliegue [cara, padre]. Se buscaron con scripts/desarrollos.mjs (sin solapes, con solapas en todas las costuras y de caja mínima).
export const ARBOLES = {
  6: [[1, -1], [0, 1], [2, 1], [3, 2], [4, 1], [5, 1]],   // la cruz: «frente» en el centro
  8: [[3, -1], [2, 3], [7, 3], [4, 7], [0, 4], [6, 2], [1, 0], [5, 6]],
  10: [[1, -1], [2, 1], [3, 2], [4, 3], [0, 1], [9, 0], [8, 9], [7, 8], [6, 7], [5, 6]],
};
