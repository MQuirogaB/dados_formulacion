// STL del dado: un poliedro cerrado (la malla es solo la superficie) con el texto de cada cara hundido, en relieve o incrustado.
// Sistema de coordenadas: x → derecha, y → hacia el fondo, z → arriba; el dado apoya en una cara y todo está en coordenadas ≥ 0.

import earcut from "./vendor/earcut.js";
import { areaFirmada, diferencia, regiones } from "./geo.js";

export class Malla {
  constructor() { this.t = []; }
  tri(a, b, c) { this.t.push(a, b, c); }
  get n() { return this.t.length / 3; }
  añadir(otra) { for (const v of otra.t) this.t.push(v); }
}

/**
 * Triángulos de una región { outer, holes } a la altura z. `arriba`: normal +z (si no, −z).
 * earcut descarta los vértices alineados con sus vecinos (la línea base de un texto, por ejemplo), y entonces un triángulo
 * puede saltar por encima de vértices que las paredes sí tienen: se parten esos triángulos para que no queden grietas.
 */
function tapa(malla, reg, z, arriba) {
  const anillos = [reg.outer, ...reg.holes];
  const plano = [], huecos = [];
  for (const a of anillos) { if (a !== reg.outer) huecos.push(plano.length / 2); for (const [x, y] of a) plano.push(x, y); }
  const idx = earcut(plano, huecos);
  const puntos = [];
  for (let i = 0; i < plano.length; i += 2) puntos.push([plano[i], plano[i + 1]]);
  const area = (a, b, c) => (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  const sobre = (a, b) => {   // vértice situado en el interior de la arista a–b
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    for (const p of puntos) {
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
      if (t > 1e-9 && t < 1 - 1e-9 && Math.abs(area(a, p, b)) < 1e-12) return p;
    }
    return null;
  };
  const cola = [];
  for (let i = 0; i < idx.length; i += 3) cola.push([puntos[idx[i]], puntos[idx[i + 1]], puntos[idx[i + 2]]]);
  while (cola.length) {
    const [a, b, c] = cola.pop();
    let partido = false;
    for (const [p, q, o] of [[a, b, c], [b, c, a], [c, a, b]]) {
      const m = sobre(p, q);
      if (m) { cola.push([p, m, o], [m, q, o]); partido = true; break; }
    }
    if (partido) continue;
    const A = [a[0], a[1], z], B = [b[0], b[1], z], Cc = [c[0], c[1], z];
    const ar = (B[0] - A[0]) * (Cc[1] - A[1]) - (Cc[0] - A[0]) * (B[1] - A[1]);
    if ((ar > 0) === arriba) malla.tri(A, B, Cc); else malla.tri(A, Cc, B);
  }
}

/** Pared que recorre un anillo entre z0 y z1; la normal cae a la derecha del sentido de recorrido
 *  (hacia fuera del material si el exterior es antihorario y los huecos horarios). */
function pared(malla, anillo, z0, z1) {
  for (let i = 0; i < anillo.length; i++) {
    const [x1, y1] = anillo[i], [x2, y2] = anillo[(i + 1) % anillo.length];
    if (x1 === x2 && y1 === y2) continue;
    malla.tri([x1, y1, z0], [x2, y2, z0], [x2, y2, z1]);
    malla.tri([x1, y1, z0], [x2, y2, z1], [x1, y1, z1]);
  }
}

/** Sólido: las regiones extruidas entre z0 y z1. */
function extruir(malla, regs, z0, z1) {
  for (const r of regs) {
    tapa(malla, r, z1, true);
    tapa(malla, r, z0, false);
    pared(malla, r.outer, z0, z1);
    for (const h of r.holes) pared(malla, h, z0, z1);
  }
}


/** Quita los vértices repetidos y los alineados: earcut los descarta al triangular y las paredes deben llevar los mismos. */
function limpiar(anillo) {
  let r = anillo, cambio = true;
  while (cambio && r.length > 3) {
    cambio = false;
    const out = [];
    for (let i = 0; i < r.length; i++) {
      const a = out.length ? out[out.length - 1] : r[(i + r.length - 1) % r.length], b = r[i], c = r[(i + 1) % r.length];
      const dup = a[0] === b[0] && a[1] === b[1];
      const cruz = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (dup || cruz === 0) { cambio = true; continue; }
      out.push(b);
    }
    r = out;
  }
  return r;
}
const limpiarRegs = (regs) => regs.map((r) => ({ outer: limpiar(r.outer), holes: r.holes.map(limpiar) }));

/** Mallas de una cara en coordenadas locales: la superficie está en z = 0 y la normal hacia fuera es +z. */
function caraLocal(C, texto, sq, modo, h) {
  const placa = new Malla();
  if (!texto.length) { tapa(placa, { outer: sq, holes: [] }, 0, true); return { placa, texto: null }; }
  const letras = limpiarRegs(regiones(C, texto));
  if (modo === "relieve") {
    tapa(placa, { outer: sq, holes: [] }, 0, true);
    const txt = new Malla();
    extruir(txt, letras, -0.2, h);
    return { placa, texto: txt, enPlaca: true };
  }
  // hundido / incrustado: la cara con las letras rehundidas h.
  // El fondo y el relleno salen de los mismos anillos que las paredes (no de las letras originales), así las mallas casan al milímetro.
  const R = limpiarRegs(regiones(C, diferencia(C, [sq], texto)));
  const principal = R.reduce((a, b) => (areaFirmada(b.outer) > areaFirmada(a.outer) ? b : a));
  principal.outer = sq; // el borde exacto de la cara, para que case con las vecinas
  const huecos = R.flatMap((r) => r.holes);
  const islas = R.filter((r) => r !== principal);
  const suelos = huecos.map((hh) => ({ outer: [...hh].reverse(), holes: [], area: Math.abs(areaFirmada(hh)), anillo: hh }));
  for (const isla of islas) {
    const dentro = suelos.filter((s) => dentroDe(isla.outer[0], s.anillo)).sort((a, b) => a.area - b.area)[0];
    if (dentro) dentro.holes.push([...isla.outer].reverse());
  }
  for (const r of R) {
    tapa(placa, r, 0, true);
    if (r !== principal) pared(placa, r.outer, -h, 0);       // islas (el centro de la «o», «a», «P»…)
    for (const hh of r.holes) pared(placa, hh, -h, 0);       // paredes del hueco de cada letra
  }
  for (const s of suelos) tapa(placa, s, -h, true);          // fondo del hueco
  let txt = null;
  if (modo === "incrustado") { txt = new Malla(); extruir(txt, suelos, -h, 0); }
  return { placa, texto: txt };
}

/** ¿Está el punto dentro del anillo? (trazado de rayos) */
function dentroDe([px, py], anillo) {
  let d = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Pasa una malla local de la cara (superficie en z = 0, normal +z) a su sitio en el dado. */
function acolocar(dest, local, cara) {
  const [nx, ny, nz] = cara.n, [rx, ry, rz] = cara.r, [ux, uy, uz] = cara.u, [ox, oy, oz] = cara.origen;
  for (const [x, y, z] of local.t) dest.t.push([ox + rx * x + ux * y + nx * z, oy + ry * x + uy * y + ny * z, oz + rz * x + uz * y + nz * z]);
}

/** Gira la malla para que la cara de abajo (la de centroide más bajo) apoye en la cama y la traslada a coordenadas ≥ 0. */
function aLaCama(mallas, poli) {
  let base = 0;
  const zc = (c) => c.verts.reduce((s, v) => s + v[2], 0) / c.verts.length;
  poli.caras.forEach((c, i) => { if (zc(c) < zc(poli.caras[base]) - 1e-9) base = i; });
  const [nx, ny, nz] = poli.caras[base].n;
  let giro = (v) => v;
  if (nz > -0.999999) {
    // Rodrigues: lleva la normal de la cara de apoyo a (0, 0, −1)
    const s = Math.hypot(ny, nx), c = -nz;
    const e = s < 1e-12 ? [1, 0, 0] : [ny / s, -nx / s, 0];
    giro = (v) => {
      const kx = e[1] * v[2] - e[2] * v[1], ky = e[2] * v[0] - e[0] * v[2], kz = e[0] * v[1] - e[1] * v[0];
      const d = e[0] * v[0] + e[1] * v[1] + e[2] * v[2];
      return [v[0] * c + kx * s + e[0] * d * (1 - c), v[1] * c + ky * s + e[1] * d * (1 - c), v[2] * c + kz * s + e[2] * d * (1 - c)];
    };
  }
  const todas = mallas.filter(Boolean);
  for (const m of todas) m.t = m.t.map(giro);
  const lo = [Infinity, Infinity, Infinity];
  for (const m of todas) for (const v of m.t) for (let k = 0; k < 3; k++) if (v[k] < lo[k]) lo[k] = v[k];
  for (const m of todas) m.t = m.t.map((v) => [v[0] - lo[0], v[1] - lo[1], v[2] - lo[2]]);
}

// ---------------------------------------------------------------------
// Aristas redondeadas
// ---------------------------------------------------------------------

const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cruz3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const claveV = (v) => v.map((x) => Math.round(x * 1e5)).join(",");

/**
 * Redondea las aristas de un poliedro convexo con radio `r` (mm). Cada cara se recorta hacia dentro (distancia r·tan(giro/2) en cada arista,
 * como un redondeo de radio r) y el hueco se rellena con una tira curva (Bézier cuadrática con el vértice agudo como punto de control)
 * por cada arista y un parche por cada vértice. Devuelve { insets, malla }: el contorno recortado de cada cara (coordenadas locales)
 * y la malla de aristas y vértices, ya orientada hacia fuera.
 */
function redondear(poli, r, N = 5) {
  const caras = poli.caras;
  const cen = [0, 0, 0];
  let nv = 0;
  for (const c of caras) for (const v of c.verts) { for (let k = 0; k < 3; k++) cen[k] += v[k]; nv++; }
  for (let k = 0; k < 3; k++) cen[k] /= nv;
  const claves = caras.map((c) => c.verts.map(claveV));
  const vecina = (f, i) => {
    const n = claves[f].length, a = claves[f][i], b = claves[f][(i + 1) % n];
    for (let g = 0; g < caras.length; g++) if (g !== f && claves[g].includes(a) && claves[g].includes(b)) return g;
    return -1;
  };
  const a3 = (c, [x, y]) => [c.origen[0] + c.r[0] * x + c.u[0] * y, c.origen[1] + c.r[1] * x + c.u[1] * y, c.origen[2] + c.r[2] * x + c.u[2] * y];

  // contorno recortado de cada cara
  const insets = caras.map((c, f) => {
    const P = c.anillo, n = P.length, sg = areaFirmada(P) > 0 ? 1 : -1;
    const rectas = P.map((a, i) => {
      const b = P[(i + 1) % n], g = vecina(f, i);
      const giro = g >= 0 ? Math.acos(Math.max(-1, Math.min(1, dot3(c.n, caras[g].n)))) : 0;
      const d = r * Math.tan(giro / 2);
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), dx = (b[0] - a[0]) / l, dy = (b[1] - a[1]) / l;
      return { p: [a[0] - sg * dy * d, a[1] + sg * dx * d], d: [dx, dy] };
    });
    return P.map((_, i) => {
      const A = rectas[(i + n - 1) % n], B = rectas[i];
      const den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
      const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
      return [A.p[0] + t * A.d[0], A.p[1] + t * A.d[1]];
    });
  });
  const in3 = caras.map((c, f) => insets[f].map((p) => a3(c, p)));

  const malla = new Malla();
  const tri = (a, b, c) => {   // orientada hacia fuera (el poliedro es convexo)
    const nn = cruz3(sub3(b, a), sub3(c, a));
    const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot3(nn, sub3(m, cen)) < 0) malla.tri(a, c, b); else malla.tri(a, b, c);
  };
  const curva = (pa, pb, Q) => Array.from({ length: N + 1 }, (_, k) => {
    const t = k / N, m = 1 - t;
    return [0, 1, 2].map((j) => m * m * pa[j] + 2 * m * t * Q[j] + t * t * pb[j]);
  });
  const cache = new Map();   // «caraMenor|caraMayor|vértice» → puntos de la curva, de la cara menor a la mayor
  const curvaEn = (f, g, vk, pf, pg, V) => {
    const k = f < g ? `${f}|${g}|${vk}` : `${g}|${f}|${vk}`;
    if (!cache.has(k)) cache.set(k, f < g ? curva(pf, pg, V) : curva(pg, pf, V));
    const pts = cache.get(k);
    return f < g ? pts : [...pts].reverse();
  };

  const enVertice = new Map();   // vértice → [{ f, i }]
  caras.forEach((c, f) => c.verts.forEach((v, i) => {
    const k = claves[f][i];
    if (!enVertice.has(k)) enVertice.set(k, []);
    enVertice.get(k).push({ f, i });
  }));

  // tiras de las aristas
  caras.forEach((c, f) => {
    const n = c.verts.length;
    for (let i = 0; i < n; i++) {
      const g = vecina(f, i);
      if (g < f) continue;
      const i1 = (i + 1) % n;
      const j0 = claves[g].indexOf(claves[f][i]), j1 = claves[g].indexOf(claves[f][i1]);
      const c0 = curvaEn(f, g, claves[f][i], in3[f][i], in3[g][j0], c.verts[i]);
      const c1 = curvaEn(f, g, claves[f][i1], in3[f][i1], in3[g][j1], c.verts[i1]);
      for (let k = 0; k < N; k++) { tri(c0[k], c0[k + 1], c1[k + 1]); tri(c0[k], c1[k + 1], c1[k]); }
    }
  });

  // parches de los vértices
  for (const [vk, lista] of enVertice) {
    const V = caras[lista[0].f].verts[lista[0].i];
    const nV = sub3(V, cen), l = Math.hypot(...nV);
    const w = nV.map((x) => x / l);
    const e1 = cruz3(w, Math.abs(w[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]), l1 = Math.hypot(...e1);
    const u1 = e1.map((x) => x / l1), u2 = cruz3(w, u1);
    const centroCara = (f) => { const vs = caras[f].verts; return [0, 1, 2].map((j) => vs.reduce((s, v) => s + v[j], 0) / vs.length); };
    const orden = lista.map((e) => {
      const d = sub3(centroCara(e.f), V);
      return { ...e, ang: Math.atan2(dot3(d, u2), dot3(d, u1)) };
    }).sort((a, b) => a.ang - b.ang);
    const lazo = [];
    for (let m = 0; m < orden.length; m++) {
      const A = orden[m], B = orden[(m + 1) % orden.length];
      const pts = curvaEn(A.f, B.f, vk, in3[A.f][A.i], in3[B.f][B.i], V);
      lazo.push(...pts.slice(0, -1));
    }
    const mx = [0, 1, 2].map((j) => lazo.reduce((s, p) => s + p[j], 0) / lazo.length);
    const P = [0, 1, 2].map((j) => 0.5 * V[j] + 0.5 * mx[j]);
    for (let m = 0; m < lazo.length; m++) tri(P, lazo[m], lazo[(m + 1) % lazo.length]);
  }
  return { insets, malla };
}

/**
 * Mallas de un dado: { cubo, textos }. `textos` = polígonos de cada cara en sus coordenadas locales; el `textos` del resultado solo existe en modo incrustado.
 * En «relieve» las letras sobresalen de la cara (y se solapan 0,2 mm con ella: el laminador las une).
 * El dado queda apoyado en una cara y todo en coordenadas ≥ 0.
 */
export function construirDado(C, poli, textos, q) {
  const h = q.profundidad;
  const cubo = new Malla(), letras = new Malla();
  const R = q.redondeo > 0 ? redondear(poli, q.redondeo) : null;
  if (R) cubo.añadir(R.malla);
  poli.caras.forEach((cara, i) => {
    const local = caraLocal(C, textos[i] || [], R ? R.insets[i] : cara.anillo, q.modoTexto, h);
    acolocar(cubo, local.placa, cara);
    if (local.texto) acolocar(local.enPlaca ? cubo : letras, local.texto, cara);
  });
  aLaCama([cubo, letras.n ? letras : null], poli);
  return { cubo, textos: letras.n ? letras : null };
}

/** Archivos STL de los dados de la hoja: [{ nombre, malla }]. `h` = resultado de hoja(). */
export function construirSTL(C, h, q) {
  const out = [];
  for (const d of h.dados) {
    if (!d.dev.caras.some((c) => c.ion)) continue;
    const nom = d.tipo === "anion" ? "aniones" : "cationes";
    const m = construirDado(C, h.poli, d.dev.caras.map((c) => c.textoLocal), q);
    if (m.textos) { out.push({ nombre: `dado-${nom}-cubo.stl`, malla: m.cubo }); out.push({ nombre: `dado-${nom}-textos.stl`, malla: m.textos }); }
    else out.push({ nombre: `dado-${nom}.stl`, malla: m.cubo });
  }
  return out;
}

// ---------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------

/** STL binario. */
export function aBinario(malla) {
  const n = malla.n;
  const buf = new ArrayBuffer(84 + 50 * n);
  const dv = new DataView(buf);
  const cab = "Dados de formulación · miguelquiroga.es";
  for (let i = 0; i < cab.length && i < 79; i++) dv.setUint8(i, cab.charCodeAt(i) & 127);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let i = 0; i < n; i++) {
    const a = malla.t[3 * i], b = malla.t[3 * i + 1], c = malla.t[3 * i + 2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [nx, ny, nz, ...a, ...b, ...c]) { dv.setFloat32(o, v, true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Uint8Array(buf);
}

const TABLA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = TABLA_CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** ZIP sin comprimir con varios archivos [{ nombre, datos: Uint8Array }]. */
export function zip(archivos) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let desplaz = 0;
  const hoy = new Date();
  const fecha = ((hoy.getFullYear() - 1980) << 9) | ((hoy.getMonth() + 1) << 5) | hoy.getDate();
  const hora = (hoy.getHours() << 11) | (hoy.getMinutes() << 5) | (hoy.getSeconds() >> 1);
  for (const a of archivos) {
    const nom = enc.encode(a.nombre), crc = crc32(a.datos), tam = a.datos.length;
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true); loc.setUint16(8, 0, true);
    loc.setUint16(10, hora, true); loc.setUint16(12, fecha, true); loc.setUint32(14, crc, true);
    loc.setUint32(18, tam, true); loc.setUint32(22, tam, true); loc.setUint16(26, nom.length, true); loc.setUint16(28, 0, true);
    partes.push(new Uint8Array(loc.buffer), nom, a.datos);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(12, hora, true); cen.setUint16(14, fecha, true); cen.setUint32(16, crc, true);
    cen.setUint32(20, tam, true); cen.setUint32(24, tam, true); cen.setUint16(28, nom.length, true); cen.setUint32(42, desplaz, true);
    central.push(new Uint8Array(cen.buffer), nom);
    desplaz += 30 + nom.length + tam;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, desplaz, true);
  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
  let o = 0; for (const x of todo) { out.set(x, o); o += x.length; }
  return out;
}
