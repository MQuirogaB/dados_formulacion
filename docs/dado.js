// Un dado: sus caras con el texto, su desarrollo plano (con solapas y pliegues) y la hoja que reúne varios dados.

import { textoCara, sanear } from "./cara.js";
import { poliedro, ARBOLES, desplegar, colocarSolapas, contornoUnido, cajaDe, aplicar, adyacencias, solapadas } from "./poliedros.js";

/** Árbol de despliegue del poliedro (el guardado en poliedros.js; si faltara, uno cualquiera sin solapes). */
function arbolDe(C, poli) {
  if (ARBOLES[poli.n]) return ARBOLES[poli.n];
  const ady = adyacencias(poli);
  const vec = Array.from({ length: poli.n }, () => []);
  for (const [x, y] of ady) { vec[x.cara].push(y.cara); vec[y.cara].push(x.cara); }
  let semilla = 7;
  const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 500; k++) {
    const raiz = Math.floor(rnd() * poli.n), dentro = new Set([raiz]), arbol = [[raiz, -1]];
    while (dentro.size < poli.n) {
      const cand = [];
      for (const i of dentro) for (const j of vec[i]) if (!dentro.has(j)) cand.push([j, i]);
      const [j, i] = cand[Math.floor(rnd() * cand.length)];
      dentro.add(j); arbol.push([j, i]);
    }
    if (!solapadas(C, desplegar(poli, arbol).pol)) return arbol;
  }
  throw new Error("no se encontró un desarrollo sin solapes");
}

/**
 * Desarrollo plano de un dado. `ions`: un ion por cara (o null en las caras vacías).
 * Devuelve (coordenadas SVG, y hacia abajo) { caras: [{ ion, texto, textoLocal, pol, cara }], corte, pliegues, caja, sinSolapa }.
 */
export function desarrollo(C, fuente, poli, ions, p) {
  const q = sanear(p);
  const arbol = arbolDe(C, poli);
  const des = desplegar(poli, arbol);
  const cache = new Map();
  const caras = poli.caras.map((cara, i) => {
    const ion = ions[i] || null;
    let textoLocal = [];
    if (ion) {
      if (!cache.has(`${i}|${ion.id}`)) cache.set(`${i}|${ion.id}`, textoCara(fuente, ion, q, cara.caja));
      textoLocal = cache.get(`${i}|${ion.id}`);
    }
    const texto = textoLocal.map((pl) => pl.map(([x, y]) => aplicar(des.T[i], [x, -y])));
    return { ion, texto, textoLocal, pol: des.pol[i], cara };
  });
  const { solapas, sinSolapa } = q.solapas ? colocarSolapas(C, poli, des, arbol) : { solapas: [], sinSolapa: [] };
  const corte = contornoUnido(C, des, solapas);
  // pliegues: las bisagras entre caras y la base de cada solapa
  const pliegues = [];
  for (const [i, padre] of arbol) {
    if (padre < 0) continue;
    const e = des.ady.find((l) => (l[0].cara === i && l[1].cara === padre) || (l[1].cara === i && l[0].cara === padre));
    const m = e[0].cara === i ? e[0] : e[1];
    const pol = des.pol[i];
    pliegues.push([pol[m.k], pol[(m.k + 1) % pol.length]]);
  }
  for (const s of solapas) pliegues.push([s.poly[0], s.poly[3]]);
  return { caras, corte, pliegues: q.pliegues ? pliegues : [], caja: cajaDe(corte), sinSolapa };
}

/** Coloca varios desarrollos uno debajo de otro. `dados` = [{ tipo, ions }]. */
export function hoja(C, fuente, dados, p) {
  const q = sanear(p);
  const poli = poliedro(q.caras, q.lado);
  let y = 0, ancho = 0;
  const out = [];
  for (const d of dados) {
    const dev = desarrollo(C, fuente, poli, d.ions, q);
    out.push({ ...d, dev, dx: -dev.caja.x1, dy: y - dev.caja.y1 });
    y += dev.caja.h + q.separacion;
    ancho = Math.max(ancho, dev.caja.w);
  }
  return { dados: out, poli, lado: q.lado, ancho, alto: Math.max(0, y - q.separacion) };
}
