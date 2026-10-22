import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import opentype from "opentype.js";
import { CATIONES, ANIONES, porId } from "../docs/iones.js";
import { sanear, textoCara, nombreIon } from "../docs/cara.js";
import { poliedro, adyacencias, desplegar, solapadas, ARBOLES, TIPOS, LADO_POR_DEFECTO } from "../docs/poliedros.js";
import { desarrollo, hoja } from "../docs/dado.js";
import { construirSVG, envolverSVG } from "../docs/svg.js";
import { construirSTL, construirDado, aBinario, zip } from "../docs/stl.js";
import { caja, areaFirmada, diferencia, engrosar } from "../docs/geo.js";

const C = createRequire(import.meta.url)("clipper-lib");
const b = fs.readFileSync(new URL("../docs/fonts/lexend-700.woff", import.meta.url));
const fuente = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
const ion = (id) => { const i = porId(id); assert.ok(i, id); return i; };
const sinNaN = (s) => assert.ok(!/NaN|undefined|Infinity/.test(s), "valores raros");
const TODOS_BIN = [...CATIONES, ...ANIONES].filter((x) => x.binario);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dist = (a, b) => Math.hypot(...sub(a, b));
const centro = (vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]).map((x) => x / vs.length);

// ---------- poliedros ----------
const ESPERADO = { 6: { caras: 6, aristas: 12, vertices: 8 }, 8: { caras: 8, aristas: 12, vertices: 6 }, 10: { caras: 10, aristas: 20, vertices: 12 } };
for (const n of TIPOS) {
  for (const lado of [LADO_POR_DEFECTO[n], 20, 60]) {
    const P = poliedro(n, lado), e = ESPERADO[n];
    assert.equal(P.caras.length, e.caras);
    assert.equal(adyacencias(P).length, e.aristas, `aristas del d${n}`);
    const vs = new Map();
    for (const c of P.caras) for (const v of c.verts) vs.set(v.map((x) => Math.round(x * 1e4)).join(), v);
    assert.equal(vs.size, e.vertices, `vértices del d${n}`);
    assert.equal(e.vertices - e.aristas + e.caras, 2, "Euler");
    const cp = centro([...vs.values()]);
    for (const c of P.caras) {
      assert.ok(c.verts.length === (n === 8 ? 3 : n === 10 ? 4 : 4));
      for (const v of c.verts) assert.ok(Math.abs(dot(sub(v, c.origen), c.n)) < 1e-6, `cara plana en d${n}`);
      assert.ok(dot(sub(centro(c.verts), cp), c.n) > 0, "normal hacia fuera");
      assert.deepEqual(cruz(c.r, c.u).map((x, i) => Math.abs(x - c.n[i]) < 1e-9), [true, true, true], "r × u = n");
      assert.ok(areaFirmada(c.anillo) > 0, "contorno antihorario");
    }
    const areas = P.caras.map((c) => areaFirmada(c.anillo));
    for (const a of areas) assert.ok(Math.abs(a - areas[0]) < 1e-6 * areas[0], "caras iguales");
    // aristas: cubo y octaedro todas iguales; decaedro con la larga = lado
    const lados = [];
    for (const c of P.caras) c.verts.forEach((v, k) => lados.push(dist(v, c.verts[(k + 1) % c.verts.length])));
    if (n === 10) assert.ok(Math.abs(Math.max(...lados) - lado) < 1e-9, "arista larga = lado");
    else for (const l of lados) assert.ok(Math.abs(l - lado) < 1e-9, `arista de d${n}`);
  }
}

// ---------- el texto cabe en la cara ----------
const cabe = (P, i, texto, margen) => {
  const anillo = engrosar(C, [P.caras[i].anillo], -margen);
  return diferencia(C, texto, anillo).length === 0;
};
for (const n of TIPOS) for (const mostrarNombre of [false, true]) for (const tam of [1, 2]) {
  const q = sanear({ caras: n, lado: LADO_POR_DEFECTO[n], mostrarNombre, tamanoTexto: tam });
  const P = poliedro(n, q.lado);
  for (const i of [...TODOS_BIN]) {
    for (const k of [0, 1, P.caras.length - 1]) {
      const t = textoCara(fuente, i, q, P.caras[k].caja);
      assert.ok(cabe(P, k, t, 0.3), `${i.id} no cabe en la cara ${k} del d${n} (nombre ${mostrarNombre}, ×${tam})`);
    }
  }
}
{ // texto centrado y con el nombre más abajo
  const q = sanear({ lado: 30 });
  const cb = caja(textoCara(fuente, ion("Fe3+"), q));
  assert.ok(Math.abs((cb.x1 + cb.x2) / 2) < 1.5 && Math.abs((cb.y1 + cb.y2) / 2) < 3);
  const sin = caja(textoCara(fuente, ion("Cl1-"), q)), con = caja(textoCara(fuente, ion("Cl1-"), sanear({ lado: 30, mostrarNombre: true })));
  assert.ok(con.y1 < sin.y1 - 1);
}
assert.equal(nombreIon(ion("Fe3+")), "Hierro(III)");
assert.equal(nombreIon(ion("Na1+")), "Sodio");
assert.equal(nombreIon(ion("Cl1-")), "Cloruro");
assert.equal(sanear({ caras: 7 }).caras, 6);
assert.equal(sanear({ caras: "10" }).caras, 10);

// ---------- desarrollos planos ----------
const seis = ["H1+", "Na1+", "Mg2+", "Al3+", "Ca2+", "Fe3+"].map(ion);
const variados = (n) => Array.from({ length: n }, (_, i) => TODOS_BIN[(i * 7) % TODOS_BIN.length]);
for (const n of TIPOS) {
  const P = poliedro(n, LADO_POR_DEFECTO[n]);
  assert.equal(ARBOLES[n].length, n, "el árbol cubre todas las caras");
  assert.equal(ARBOLES[n].filter(([, p]) => p < 0).length, 1, "una sola raíz");
  assert.equal(solapadas(C, desplegar(P, ARBOLES[n]).pol), null, `el desarrollo del d${n} no se solapa`);
  for (const solapas of [false, true]) for (const pliegues of [false, true]) {
    const q = sanear({ caras: n, lado: LADO_POR_DEFECTO[n], solapas, pliegues });
    const d = desarrollo(C, fuente, P, variados(n), q);
    assert.equal(d.corte.length, 1, "un único contorno de corte");
    assert.equal(d.sinSolapa.length, 0, "todas las costuras tienen solapa");
    const areaCaras = P.caras.length * areaFirmada(P.caras[0].anillo);
    assert.ok(Math.abs(Math.abs(areaFirmada(d.corte[0])) - areaCaras) < 1 || solapas, "área del contorno");
    if (solapas) assert.ok(Math.abs(areaFirmada(d.corte[0])) > areaCaras + 10, "con solapas, más área");
    assert.equal(d.pliegues.length, pliegues ? (solapas ? ESPERADO[n].aristas : n - 1) : 0, `pliegues del d${n}`);
    assert.ok(d.caja.w > d.caja.h * 0.9, "desarrollo horizontal");
  }
}
{ // cada texto cae dentro de su cara en el desarrollo
  for (const n of TIPOS) {
    const q = sanear({ caras: n, lado: LADO_POR_DEFECTO[n], solapas: false });
    const d = desarrollo(C, fuente, poliedro(n, q.lado), variados(n), q);
    for (const c of d.caras) assert.equal(diferencia(C, c.texto, engrosar(C, [c.pol], -0.2)).length, 0, "texto fuera de su cara");
  }
}
{ // el cubo mantiene su cruz: 4 en fila + 1 arriba + 1 abajo (con una solapa en cada costura)
  const q = sanear({ lado: 30, solapas: false });
  const d = desarrollo(C, fuente, poliedro(6, 30), seis, q);
  assert.ok(Math.abs(d.caja.w - 120) < 1e-6 && Math.abs(d.caja.h - 90) < 1e-6, JSON.stringify(d.caja));
  assert.ok(Math.abs(Math.abs(areaFirmada(d.corte[0])) - 6 * 900) < 1);
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
  const v = construirSVG(h, { vista: true, activa: { tipo: "cation", cara: 2 } });
  sinNaN(v.inner);
  assert.equal((v.inner.match(/class="cara/g) || []).length, 12);
  assert.equal((v.inner.match(/class="cara activa"/g) || []).length, 1);
  for (const n of [8, 10]) {
    const qn = sanear({ caras: n, lado: LADO_POR_DEFECTO[n] });
    const hn = hoja(C, fuente, [{ tipo: "cation", ions: variados(n) }], qn);
    const sn = construirSVG(hn);
    sinNaN(sn.inner);
    assert.ok(sn.w > 0 && sn.h > 0);
    assert.equal((construirSVG(hn, { vista: true }).inner.match(/class="cara/g) || []).length, n);
  }
}

// ---------- STL: mallas cerradas ----------
const clave = (v) => v.map((x) => Math.round(x * 1e4)).join(",");
function cerrada(malla, etiqueta) {
  const m = new Map();
  for (let i = 0; i < malla.n; i++) {
    const [a, b, c] = [malla.t[3 * i], malla.t[3 * i + 1], malla.t[3 * i + 2]].map(clave);
    for (const [p, q] of [[a, b], [b, c], [c, a]]) { if (p === q) continue; m.set(`${p}>${q}`, (m.get(`${p}>${q}`) || 0) + 1); }
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
const volumenPoli = (P) => { // volumen del poliedro sin texto: pirámides desde el centro
  const c = centro(P.caras.flatMap((f) => f.verts));
  let v = 0;
  for (const f of P.caras) v += (areaFirmada(f.anillo) * dot(sub(f.origen, c), f.n)) / 3;
  return v;
};
const dado = (n, ions, extra = {}, tipo = "cation") => {
  const q = sanear({ caras: n, lado: LADO_POR_DEFECTO[n], ...extra });
  const P = poliedro(n, q.lado);
  return { q, P, h: { dados: [{ tipo, dev: desarrollo(C, fuente, P, ions, q) }], poli: P, lado: q.lado } };
};
for (const n of TIPOS) for (const modo of ["hundido", "relieve", "incrustado"]) {
  const { q, P, h } = dado(n, variados(n), { modoTexto: modo, profundidad: 0.8 });
  const archivos = construirSTL(C, h, q);
  assert.equal(archivos.length, modo === "incrustado" ? 2 : 1, `${n} ${modo}`);
  for (const a of archivos) { cerrada(a.malla, `d${n} ${modo} ${a.nombre}`); assert.ok(a.malla.n > 12); }
  const cubo = archivos[0].malla, e = extension(cubo), vol = volumen(cubo), V0 = volumenPoli(P);
  assert.ok(e.lo.every((x) => Math.abs(x) < 1e-6), `d${n} ${modo}: nada por debajo de 0 ${JSON.stringify(e.lo)}`);
  const apoyo = cubo.t.filter((v) => Math.abs(v[2]) < 1e-6).length;
  assert.ok(apoyo >= 3, `d${n} ${modo}: apoya en una cara`);
  if (modo === "hundido" || modo === "incrustado") {
    assert.ok(vol < V0 && vol > V0 * 0.9, `d${n} ${modo}: volumen ${vol} de ${V0}`);
    if (n === 6) assert.ok(e.hi.every((x) => Math.abs(x - 30) < 1e-6), "el cubo ocupa 0–30");
  } else {
    assert.ok(vol > V0, `d${n}: con relieve pesa más`);
    if (n === 6) assert.ok(e.hi.every((x) => Math.abs(x - 31.6) < 1e-6), JSON.stringify(e));
  }
  if (modo === "incrustado") {
    const tex = archivos[1].malla;
    assert.ok(volumen(tex) > 0);
    assert.ok(Math.abs(vol + volumen(tex) - V0) < 0.5, `d${n}: cubo + textos = poliedro (${vol + volumen(tex)} vs ${V0})`);
  }
}
{ // caras vacías y repetidas
  for (const n of TIPOS) {
    const raros = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? null : ion(i % 2 ? "Cl1-" : "O2-")));
    const { q, h } = dado(n, raros, { modoTexto: "hundido" }, "anion");
    const archivos = construirSTL(C, h, q);
    assert.equal(archivos[0].nombre, "dado-aniones.stl");
    cerrada(archivos[0].malla, `d${n} caras vacías`);
    const vacio = dado(n, new Array(n).fill(null)).h;
    assert.equal(construirSTL(C, vacio, sanear({ caras: n })).length, 0, "un dado sin iones no genera archivo");
  }
}
{ // orientación en el cubo: la cara frontal mira hacia −y; el texto se lee según +x (derecha) y +z (arriba)
  const solo = [null, ion("H1+"), null, null, null, null];
  const { q, h } = dado(6, solo, { lado: 30, modoTexto: "relieve", profundidad: 1 });
  const [a] = construirSTL(C, h, q);
  const salientes = a.malla.t.filter((v) => v[1] < 0.5);
  assert.ok(salientes.length > 0);
  const lo = (k) => Math.min(...salientes.map((v) => v[k])), hi = (k) => Math.max(...salientes.map((v) => v[k]));
  assert.ok(lo(0) > 3 && hi(0) < 27 && lo(2) > 3 && hi(2) < 27, "dentro de la cara frontal");
  assert.ok(Math.abs(hi(1)) < 1e-6 && Math.abs(lo(1)) < 1e-6, "sobresale 1 mm");
}

// ---------- binario y ZIP ----------
{
  const { q, h } = dado(6, seis);
  const [a] = construirSTL(C, h, q);
  const bin = aBinario(a.malla);
  assert.equal(bin.length, 84 + 50 * a.malla.n);
  assert.equal(new DataView(bin.buffer).getUint32(80, true), a.malla.n);
  const z = zip([{ nombre: "a.stl", datos: bin }, { nombre: "b.stl", datos: new Uint8Array([1, 2, 3]) }]);
  assert.equal(new DataView(z.buffer).getUint32(0, true), 0x04034b50);
  assert.equal(new DataView(z.buffer).getUint16(z.length - 22 + 10, true), 2);
}

console.log("ok");
