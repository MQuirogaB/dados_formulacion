// Busca desarrollos planos de los dados: árboles de despliegue sin solapes y con solapas en todas las costuras.
// Uso: node scripts/desarrollos.mjs 8|10 [intentos]   (pega el árbol resultante en ARBOLES de docs/poliedros.js)
import { createRequire } from "node:module";
import { poliedro, adyacencias, desplegar, solapadas, colocarSolapas, contornoUnido, cajaDe, LADO_POR_DEFECTO } from "../docs/poliedros.js";

const C = createRequire(import.meta.url)("clipper-lib");
const n = Number(process.argv[2] || 8), intentos = Number(process.argv[3] || 3000);
const poli = poliedro(n, LADO_POR_DEFECTO[n]);
const ady = adyacencias(poli);
const vecinos = Array.from({ length: n }, () => []);
for (const [x, y] of ady) { vecinos[x.cara].push(y.cara); vecinos[y.cara].push(x.cara); }

let semilla = Number(process.argv[4] || 12345);
const rnd = () => ((semilla = (semilla * 1664525 + 1013904223) >>> 0) / 4294967296);

function arbolAzar() {
  const raiz = Math.floor(rnd() * n);
  const dentro = new Set([raiz]), arbol = [[raiz, -1]];
  while (dentro.size < n) {
    const cand = [];
    for (const i of dentro) for (const j of vecinos[i]) if (!dentro.has(j)) cand.push([j, i]);
    const [j, i] = cand[Math.floor(rnd() * cand.length)];
    dentro.add(j); arbol.push([j, i]);
  }
  return arbol;
}

let mejor = null;
for (let k = 0; k < intentos; k++) {
  const arbol = arbolAzar();
  const des = desplegar(poli, arbol);
  if (solapadas(C, des.pol)) continue;
  const { solapas, sinSolapa } = colocarSolapas(C, poli, des, arbol);
  if (sinSolapa.length > (mejor ? mejor.faltan : 99)) continue;
  const cb = cajaDe(contornoUnido(C, des, solapas));
  if (cb.w < cb.h) continue;   // horizontal: los dados se apilan en vertical en la hoja
  const puntuacion = cb.w * cb.h;
  if (!mejor || sinSolapa.length < mejor.faltan || puntuacion < mejor.puntuacion) { mejor = { arbol, puntuacion, faltan: sinSolapa.length, w: cb.w, h: cb.h }; console.error(`#${k}: ${cb.w.toFixed(0)} × ${cb.h.toFixed(0)} mm, costuras sin solapa: ${sinSolapa.length}`); }
}
console.log(mejor ? JSON.stringify(mejor.arbol) : "sin resultado");
