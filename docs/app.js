import opentype from "opentype.js";

import { CATIONES, ANIONES, FAMILIAS_CATION, FAMILIAS_ANION, ionBonito } from "./iones.js?v=2";
import { DEFAULTS, sanear } from "./cara.js?v=2";
import { hoja } from "./dado.js?v=2";
import { LADO_POR_DEFECTO } from "./poliedros.js?v=2";
import { construirSVG, envolverSVG } from "./svg.js?v=2";
import { construirSTL, aBinario, zip } from "./stl.js?v=2";

const el = (id) => document.getElementById(id);

window.addEventListener("error", (e) => {
  const s = el("status");
  if (s) { s.textContent = "Error: " + (e.message || "no se pudo iniciar") + ". Prueba a recargar con Ctrl+Shift+R."; s.classList.add("error"); }
});

const statusEl = el("status");
const holder = el("svg-holder");

// ---------------------------------------------------------------------
// Tipografías
// ---------------------------------------------------------------------

const FONTS = [
  { id: "lexend", nombre: "Lexend", archivo: "lexend-700" },
  { id: "atkinson", nombre: "Atkinson Hyperlegible", archivo: "atkinson-hyperlegible-700" },
  { id: "nunito", nombre: "Nunito", archivo: "nunito-700" },
  { id: "montserrat", nombre: "Montserrat", archivo: "montserrat-700" },
];
const cacheFuentes = {};
async function cargarFuente(archivo) {
  if (!cacheFuentes[archivo]) {
    const res = await fetch(`./fonts/${archivo}.woff`);
    if (!res.ok) throw new Error("no se pudo cargar la letra");
    cacheFuentes[archivo] = opentype.parse(await res.arrayBuffer());
  }
  return cacheFuentes[archivo];
}
const fuenteElegida = () => FONTS.find((f) => f.id === el("fontFamily").value) || FONTS[0];

// ---------------------------------------------------------------------
// Estado: el ion de cada cara de cada dado
// ---------------------------------------------------------------------

const TODOS = [...CATIONES, ...ANIONES];
const porId = (id) => TODOS.find((i) => i.id === id);
const dados = { cation: Array(10).fill(null), anion: Array(10).fill(null) };   // ids de ion (o null); solo cuentan las primeras N caras
const activo = { tipo: "cation", cara: 0 };
let nCaras = 6;

const NUM_FIELDS = ["lado", "tamanoTexto", "profundidad", "separacion"];
const CHECK_FIELDS = ["mostrarNombre", "solapas", "pliegues"];

function leerParametros() {
  const p = {};
  for (const k of NUM_FIELDS) { const v = Number(el(k).value); p[k] = el(k).value !== "" && Number.isFinite(v) ? v : DEFAULTS[k]; }
  for (const k of CHECK_FIELDS) p[k] = el(k).checked;
  p.modoTexto = el("modoTexto").value;
  p.caras = nCaras;
  return sanear(p);
}

function aplicarDefectos() {
  for (const k of NUM_FIELDS) el(k).value = DEFAULTS[k];
  el("lado").value = LADO_POR_DEFECTO[nCaras];
  for (const k of CHECK_FIELDS) el(k).checked = DEFAULTS[k];
  el("modoTexto").value = DEFAULTS.modoTexto;
  el("fontFamily").value = FONTS[0].id;
}

// ---------------------------------------------------------------------
// Selector de caras e iones
// ---------------------------------------------------------------------

const ETIQUETA_CUBO = ["izquierda", "frente", "derecha", "fondo", "arriba", "abajo"];
const POSICION_CUBO = [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]];   // columna, fila en la cruz

function pintarCaras() {
  const cont = el("caras");
  cont.className = (nCaras === 6 ? "cruz " : "rejilla ") + activo.tipo;
  cont.replaceChildren();
  for (let i = 0; i < nCaras; i++) {
    const ion = dados[activo.tipo][i] ? porId(dados[activo.tipo][i]) : null;
    const etiqueta = nCaras === 6 ? ETIQUETA_CUBO[i] : `cara ${i + 1}`;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cara-btn" + (ion ? "" : " vacia");
    if (nCaras === 6) { b.style.gridColumn = POSICION_CUBO[i][0] + 1; b.style.gridRow = POSICION_CUBO[i][1] + 1; }
    b.setAttribute("aria-pressed", String(activo.cara === i));
    b.setAttribute("aria-label", `Cara ${i + 1} (${etiqueta}): ${ion ? ion.f : "vacía"}`);
    b.innerHTML = ion ? `${ionBonito(ion)}<small>${etiqueta}</small>` : `vacía<small>${etiqueta}</small>`;
    b.addEventListener("click", () => { activo.cara = i; cambio(); });
    cont.append(b);
  }
}

function pintarIones() {
  const cont = el("iones");
  const lista = activo.tipo === "cation" ? CATIONES : ANIONES, familias = activo.tipo === "cation" ? FAMILIAS_CATION : FAMILIAS_ANION;
  cont.replaceChildren();
  for (const fam of familias) {
    const ions = lista.filter((i) => i.binario && i.familia === fam);
    if (!ions.length) continue;
    const d = document.createElement("details");
    d.open = true;
    const s = document.createElement("summary");
    s.textContent = fam;
    const chips = document.createElement("div");
    chips.className = "chips";
    for (const ion of ions) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.id = ion.id;
      b.dataset.buscar = `${ion.f} ${ion.elem || ion.nombre} ${ion.trad || ""}`.toLowerCase();
      b.title = `Poner ${ion.elem || ion.nombre}${ion.trad ? " (" + ion.trad + ")" : ""} en la cara elegida`;
      b.innerHTML = `${ionBonito(ion)}<span class="nom">${ion.elem || ion.nombre}</span><span class="cuenta" hidden></span>`;
      b.addEventListener("click", () => ponerIon(ion.id));
      chips.append(b);
    }
    d.append(s, chips);
    cont.append(d);
  }
  filtrar();
}

function filtrar() {
  const q = el("filtro").value.trim().toLowerCase();
  for (const b of document.querySelectorAll(".chip")) b.classList.toggle("oculto", !!q && !b.dataset.buscar.includes(q));
  for (const d of document.querySelectorAll(".iones details")) d.hidden = !!q && ![...d.querySelectorAll(".chip")].some((b) => !b.classList.contains("oculto"));
}

function ponerIon(id) {
  const caras = dados[activo.tipo];
  caras[activo.cara] = id;
  // pasa a la siguiente cara vacía (si no queda ninguna, se queda donde está)
  for (let k = 1; k <= nCaras; k++) { const j = (activo.cara + k) % nCaras; if (!caras[j]) { activo.cara = j; break; } }
  cambio(true);
}

function marcarUsos() {
  const cuentas = {};
  for (const id of dados[activo.tipo].slice(0, nCaras)) if (id) cuentas[id] = (cuentas[id] || 0) + 1;
  for (const b of document.querySelectorAll(".chip")) {
    const n = cuentas[b.dataset.id] || 0, c = b.querySelector(".cuenta");
    c.hidden = !n; c.textContent = `×${n}`;
    b.classList.toggle("elegido", n > 0);
  }
}

function barajar(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function cambio() {
  document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tipo === activo.tipo)));
  pintarCaras();
  marcarUsos();
  const n = dados[activo.tipo].slice(0, nCaras).filter(Boolean).length;
  el("guia").textContent = n === 0
    ? "Pulsa una cara y luego el ion que quieras ponerle (o pulsa un ion y se coloca en la siguiente cara libre)."
    : `${n} de ${nCaras} caras con ion en este dado. Pulsa una cara para cambiarla.`;
  scheduleGenerate();
}

// ---------------------------------------------------------------------
// Vista previa y descargas
// ---------------------------------------------------------------------

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function setStatus(msg, isError = false) { statusEl.textContent = msg; statusEl.classList.toggle("error", isError); }

let estado = null; // { h, q, ctx }
let busy = false, pending = false;

async function generate() {
  if (busy) { pending = true; return; }
  busy = true;
  try {
    const q = leerParametros();
    const con = ["cation", "anion"].filter((t) => dados[t].slice(0, nCaras).some(Boolean));
    if (!con.length) {
      estado = null; el("svg-btn").disabled = true; el("stl-btn").disabled = true;
      el("stats").textContent = ""; el("avisos").textContent = "";
      holder.innerHTML = `<p class="vacio-msg vista-vacia">Elige los iones de las caras para ver el desarrollo de cada dado.</p>`;
      setStatus("Añade algún ion para ver los dados.");
      return;
    }
    const fuente = await cargarFuente(fuenteElegida().archivo);
    if (!window.ClipperLib) throw new Error("no se cargó la librería de bordes");
    const ctx = { fuente, clipper: window.ClipperLib };
    const h = hoja(ctx.clipper, fuente, con.map((t) => ({ tipo: t, ions: dados[t].slice(0, nCaras).map((id) => (id ? porId(id) : null)) })), q);
    const vista = construirSVG(h, { vista: true, activa: { tipo: activo.tipo, cara: activo.cara } });
    holder.innerHTML = envolverSVG(vista.w, vista.h, vista.inner);
    holder.querySelectorAll("g.cara").forEach((g) => g.addEventListener("click", () => {
      activo.tipo = g.dataset.tipo; activo.cara = Number(g.dataset.cara);
      pintarIones(); cambio(true);
    }));
    el("stats").textContent = `${con.length === 2 ? "2 dados" : "1 dado"} de ${q.caras} caras · ${q.lado} mm · hoja de ${vista.w.toFixed(0)} × ${vista.h.toFixed(0)} mm`;
    el("avisos").textContent = "";
    estado = { h, q, ctx };
    el("svg-btn").disabled = false; el("stl-btn").disabled = false;
    setStatus("Listo. Puedes descargar el SVG o el STL.");
  } catch (err) {
    console.error(err);
    setStatus("Error al generar: " + (err?.message || err), true);
  } finally {
    busy = false;
    if (pending) { pending = false; generate(); }
  }
}

let debounce = null;
function scheduleGenerate() { clearTimeout(debounce); debounce = setTimeout(generate, 220); }

el("svg-btn").addEventListener("click", () => {
  if (!estado) return;
  const s = construirSVG(estado.h);
  saveBlob(new Blob([envolverSVG(s.w, s.h, s.inner, "Dados de formulación")], { type: "image/svg+xml" }), "dados-formulacion.svg");
});

el("stl-btn").addEventListener("click", () => {
  if (!estado) return;
  try {
    setStatus("Preparando el STL…");
    const archivos = construirSTL(estado.ctx.clipper, estado.h, estado.q);
    const datos = archivos.map((a) => ({ nombre: a.nombre, datos: aBinario(a.malla) }));
    if (datos.length === 1) saveBlob(new Blob([datos[0].datos], { type: "model/stl" }), datos[0].nombre);
    else saveBlob(new Blob([zip(datos)], { type: "application/zip" }), "dados-formulacion-stl.zip");
    setStatus(datos.length === 1 ? "STL descargado." : `ZIP con ${datos.length} STL descargado.`);
  } catch (err) {
    console.error(err);
    setStatus("Error al crear el STL: " + (err?.message || err), true);
  }
});

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------

document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { activo.tipo = t.dataset.tipo; activo.cara = Math.max(0, dados[activo.tipo].slice(0, nCaras).findIndex((x) => !x)); pintarIones(); cambio(true); }));
const ETIQUETA_LADO = { 6: "Arista del cubo (mm)", 8: "Arista del octaedro (mm)", 10: "Arista larga del decaedro (mm)" };
function elegirCaras(n, conservarTamano = false) {
  nCaras = n;
  document.querySelectorAll(".caras-btn").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.caras) === n)));
  el("lado-etq").textContent = ETIQUETA_LADO[n];
  if (!conservarTamano) el("lado").value = LADO_POR_DEFECTO[n];
  if (activo.cara >= n) activo.cara = 0;
  cambio();
}
document.querySelectorAll(".caras-btn").forEach((b) => b.addEventListener("click", () => elegirCaras(Number(b.dataset.caras))));
el("filtro").addEventListener("input", filtrar);
el("vaciar-cara").addEventListener("click", () => { dados[activo.tipo][activo.cara] = null; cambio(true); });
el("vaciar").addEventListener("click", () => { dados[activo.tipo] = Array(10).fill(null); activo.cara = 0; cambio(true); });
el("azar").addEventListener("click", () => {
  const lista = (activo.tipo === "cation" ? CATIONES : ANIONES).filter((i) => i.binario);
  dados[activo.tipo] = [...barajar([...lista]).slice(0, nCaras).map((i) => i.id), ...Array(10 - nCaras).fill(null)];
  activo.cara = 0; cambio(true);
});
for (const k of [...NUM_FIELDS, ...CHECK_FIELDS, "modoTexto", "fontFamily"]) { el(k).addEventListener("input", scheduleGenerate); el(k).addEventListener("change", scheduleGenerate); }
el("reset-btn").addEventListener("click", () => { aplicarDefectos(); scheduleGenerate(); });

// arranque
for (const f of FONTS) { const o = document.createElement("option"); o.value = f.id; o.textContent = f.nombre; el("fontFamily").append(o); }
aplicarDefectos();
el("lado-etq").textContent = ETIQUETA_LADO[nCaras];
pintarIones();
cambio(true);
generate();
