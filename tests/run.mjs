import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import opentype from "opentype.js";
import { CATIONES, ANIONES, porId } from "../docs/iones.js";
import { sanear, textoCara, nombreIon } from "../docs/cara.js";
import { CARAS, desarrollo, hoja } from "../docs/cubo.js";
import { construirSVG, envolverSVG } from "../docs/svg.js";
import { construirSTL, construirDado, aBinario, zip } from "../docs/stl.js";
import { caja, areaFirmada } from "../docs/geo.js";

const C = createRequire(import.meta.url)("clipper-lib");
const b = fs.readFileSync(new URL("../docs/fonts/lexend-700.woff", import.meta.url));
const fuente = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const ion = (id) => { const i = porId(id); assert.ok(i, id); return i; };
const sinNaN = (s) => assert.ok(!/NaN|undefined|Infinity/.test(s), "valores raros");

// ---------- las caras ----------
assert.deepEqual(CARAS.map((c) => c.id), ["izq", "frente", "der", "fondo", "arriba", "abajo"]);
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]].map((x) => x + 0);
for (const c of CARAS) assert.deepEqual(cruz(c.r, c.u), c.n, "r × u = n en " + c.id);   // giro propio: el texto no sale al revés
assert.equal(new Set(CARAS.map((c) => c.n.join())).size, 6, "seis normales distintas");

// ---------- el texto cabe en la cara con todos los iones, con y sin nombre ----------
for (const lado of [20, 30, 50]) for (const mostrarNombre of [false, true]) for (const tam of [1, 2]) {
  const q = sanear({ lado, mostrarNombre, tamanoTexto: tam });
  for (const i of [...CATIONES, ...ANIONES].filter((x) => x.binario)) {
    const cb = caja(textoCara(fuente, i, q));
    const m = lado / 2 - 0.5;
    assert.ok(cb.x1 > -m && cb.x2 < m && cb.y1 > -m && cb.y2 < m, `${i.id} no cabe (lado ${lado}, nombre ${mostrarNombre}, ×${tam}): ${JSON.stringify(cb)}`);
  }
}
{ // el texto está centrado y la y va hacia arriba: la carga queda por encima de la línea base
  const cb = caja(textoCara(fuente, ion("Fe3+"), sanear({ lado: 30 })));
  assert.ok(Math.abs((cb.x1 + cb.x2) / 2) < 1.5, "centrado en x");
  assert.ok(Math.abs((cb.y1 + cb.y2) / 2) < 3, "centrado en y");
  const sinNombre = caja(textoCara(fuente, ion("Cl1-"), sanear({ lado: 30 })));
  const conNombre = caja(textoCara(fuente, ion("Cl1-"), sanear({ lado: 30, mostrarNombre: true })));
  assert.ok(conNombre.y1 < sinNombre.y1 - 1, "el nombre baja el borde inferior");
}
assert.equal(nombreIon(ion("Fe3+")), "Hierro(III)");
assert.equal(nombreIon(ion("Na1+")), "Sodio");
assert.equal(nombreIon(ion("Cl1-")), "Cloruro");

// ---------- desarrollo plano ----------
const seis = ["H1+", "Na1+", "Mg2+", "Al3+", "Ca2+", "Fe3+"].map(ion);
for (const solapas of [false, true]) {
  const q = sanear({ lado: 30, solapas });
  const d = desarrollo(C, fuente, seis, q);
  assert.equal(d.corte.length, 1, "un único contorno de corte");
  const area = Math.abs(areaFirmada(d.corte[0]));
  if (!solapas) { assert.ok(Math.abs(area - 6 * 900) < 1, "6 cuadros: " + area); assert.ok(Math.abs(d.caja.w - 120) < 1e-6 && Math.abs(d.caja.h - 90) < 1e-6); }
  else {
    const t = 30 * 0.22;
    assert.ok(area > 6 * 900 + 7 * 30 * t * 0.5, "con solapas: " + area);
    assert.ok(Math.abs(d.caja.w - (120 + t)) < 1e-6 && Math.abs(d.caja.h - (90 + 2 * t)) < 1e-6, JSON.stringify(d.caja));
  }
  assert.equal(d.pliegues.length, solapas ? 12 : 5);
  // cada texto cae dentro de su cuadro
  for (const c of d.caras) {
    const cb = caja(c.texto), L = 30, x0 = c.cara.col * L, y0 = c.cara.fila * L;
    assert.ok(cb.x1 > x0 && cb.x2 < x0 + L && cb.y1 > y0 && cb.y2 < y0 + L, "texto fuera de su cara " + c.cara.id);
  }
}

// ---------- SVG ----------
{
  const q = sanear({ lado: 30 });
  const h = hoja(C, fuente, [{ tipo: "cation", ions: seis }, { tipo: "anion", ions: ["Cl1-", "O2-", null, "N3-", "S2-", "F1-"].map((x) => x && ion(x)) }], q);
  assert.equal(h.dados.length, 2);
  assert.ok(h.alto > 2 * 90);
  const s = construirSVG(h), svg = envolverSVG(s.w, s.h, s.inner, "Dados");
  sinNaN(svg);
  for (const id of ["grabado", "corte", "pliegues", "corte-cationes", "corte-aniones", "texto-cationes"]) assert.ok(svg.includes(`id="${id}"`), id);
  assert.ok(svg.includes("#ff0000") && svg.includes("#000000") && svg.includes("#0000ff"));
  const v = construirSVG(h, { vista: true });
  sinNaN(v.inner);
  assert.equal((v.inner.match(/class="cara/g) || []).length, 12);
  const sin = construirSVG(hoja(C, fuente, [{ tipo: "cation", ions: seis }], sanear({ pliegues: false, solapas: false })), {});
  assert.ok(sin.inner.includes("corte-cationes"));
}

// ---------- STL: mallas cerradas ----------
const clave = (v) => v.map((x) => Math.round(x * 1e4)).join(",");
function cerrada(malla, etiqueta) {
  const m = new Map();
  for (let i = 0; i < malla.n; i++) {
    const [a, b, c] = [malla.t[3 * i], malla.t[3 * i + 1], malla.t[3 * i + 2]].map(clave);
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      if (p === q) continue;
      m.set(`${p}>${q}`, (m.get(`${p}>${q}`) || 0) + 1);
    }
  }
  let abiertas = 0;
  for (const [k, n] of m) { const [p, q] = k.split(">"); if ((m.get(`${q}>${p}`) || 0) !== n) abiertas++; }
  assert.equal(abiertas, 0, `${etiqueta}: ${abiertas} aristas abiertas`);
}
function volumen(malla) {
  let v = 0;
  for (let i = 0; i < malla.n; i++) {
    const [a, b, c] = [malla.t[3 * i], malla.t[3 * i + 1], malla.t[3 * i + 2]];
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}
function extension(malla) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of malla.t) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  return { lo, hi };
}
const conLetrasCaras = (ions, q) => {
  const d = desarrollo(C, fuente, ions, q);
  return { dev: d, tipo: "cation" };
};
for (const modo of ["hundido", "relieve", "incrustado"]) {
  const q = sanear({ lado: 30, modoTexto: modo, profundidad: 0.8 });
  const h = { dados: [{ ...conLetrasCaras(seis, q) }], lado: 30 };
  const archivos = construirSTL(C, h, q);
  assert.equal(archivos.length, modo === "incrustado" ? 2 : 1, modo);
  for (const a of archivos) { cerrada(a.malla, `${modo} ${a.nombre}`); assert.ok(a.malla.n > 12); }
  const cubo = archivos[0].malla, e = extension(cubo);
  const vol = volumen(cubo);
  if (modo === "hundido" || modo === "incrustado") {
    assert.ok(e.lo.every((x) => Math.abs(x) < 1e-6) && e.hi.every((x) => Math.abs(x - 30) < 1e-6), "el cubo ocupa 0–30 " + JSON.stringify(e));
    assert.ok(vol < 27000 && vol > 27000 - 6 * 900 * 0.8 * 0.5, "volumen " + vol);   // cada letra le quita material
  } else {
    assert.ok(e.hi.every((x) => Math.abs(x - 31.6) < 1e-6) && e.lo.every((x) => Math.abs(x) < 1e-6), JSON.stringify(e));
    assert.ok(vol > 27000, "con relieve pesa más: " + vol);
  }
  if (modo === "incrustado") {
    const tex = archivos[1].malla, et = extension(tex);
    assert.ok(volumen(tex) > 0 && et.lo.every((x) => x > -1e-6) && et.hi.every((x) => x < 30 + 1e-6), "los textos caben en el cubo");
    // cubo + textos = cubo entero
    assert.ok(Math.abs(vol + volumen(tex) - 27000) < 1, `cubo + textos = 27000 (${vol + volumen(tex)})`);
  }
}
{ // caras vacías y repetidas
  const q = sanear({ lado: 25, modoTexto: "hundido" });
  const raros = [null, ion("Cl1-"), ion("Cl1-"), null, ion("O2-"), null];
  const archivos = construirSTL(C, { dados: [{ ...conLetrasCaras(raros, q), tipo: "anion" }] }, q);
  assert.equal(archivos[0].nombre, "dado-aniones.stl");
  cerrada(archivos[0].malla, "caras vacías");
  const todoVacio = construirSTL(C, { dados: [{ ...conLetrasCaras(new Array(6).fill(null), q), tipo: "cation" }] }, q);
  assert.equal(todoVacio.length, 0, "un dado sin iones no genera archivo");
}
{ // orientación: en la cara frontal (mira hacia −y) el texto se lee de izquierda a derecha según +x y de abajo arriba según +z
  const q = sanear({ lado: 30, modoTexto: "relieve", profundidad: 1 });
  const solo = [null, ion("H1+"), null, null, null, null];
  const [a] = construirSTL(C, { dados: [{ ...conLetrasCaras(solo, q), tipo: "cation" }] }, q);
  const salientes = a.malla.t.filter((v) => v[1] < 0.5);        // vértices delante de la cara frontal: solo la cresta del relieve (con relieve, la cara queda en y = 1)
  assert.ok(salientes.length > 0);
  const lo = (k) => Math.min(...salientes.map((v) => v[k])), hi = (k) => Math.max(...salientes.map((v) => v[k]));
  assert.ok(lo(0) > 3 && hi(0) < 27 && lo(2) > 3 && hi(2) < 27, "dentro de la cara frontal");
  assert.ok(Math.abs(hi(1)) < 1e-6 && Math.abs(lo(1)) < 1e-6, "sobresale 1 mm de la cara (y = 1) hasta y = 0");
}

// ---------- binario y ZIP ----------
{
  const q = sanear({});
  const [a] = construirSTL(C, { dados: [{ ...conLetrasCaras(seis, q), tipo: "cation" }] }, q);
  const bin = aBinario(a.malla);
  assert.equal(bin.length, 84 + 50 * a.malla.n);
  assert.equal(new DataView(bin.buffer).getUint32(80, true), a.malla.n);
  const z = zip([{ nombre: "a.stl", datos: bin }, { nombre: "b.stl", datos: new Uint8Array([1, 2, 3]) }]);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(z.buffer).getUint16(z.length - 22 + 10, true), 2);
}

console.log("ok");
