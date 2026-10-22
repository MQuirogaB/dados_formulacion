# Dados de formulación · STL y SVG

Generador de **dados para aprender formulación y nomenclatura**: un dado de cationes y otro de aniones, con un ion en cada cara. Tiras los dos y formulas el compuesto que sale. Eliges si los dados tienen **6 caras (cubo), 8 (octaedro) o 10 (decaedro)**, pones el ion de cada cara (o rellenas el dado al azar) y descargas:

- **STL** de cada dado para imprimir en 3D (apoyado en una cara): texto hundido, en relieve, o hundido con las letras aparte para imprimirlas de otro color (con dos archivos, ZIP).
- **SVG** con el desarrollo plano de cada dado (cruz en el cubo) para láser: contorno de corte en rojo, letras en negro (grabado), pliegues en azul discontinuo y solapas de pegado opcionales.

Todo ocurre en el navegador; no se sube nada a ningún servidor.

## Qué incluye
- Lista larga de iones monoatómicos (`docs/iones.js`, la misma que el puzle de formulación): ~45 cationes y ~17 aniones. Los poliatómicos están en la lista con `binario: false`, preparados para la siguiente fase.
- Cada cara lleva la fórmula grande y centrada con la carga en superíndice (Fe³⁺, O₂²⁻…) y, si quieres, el nombre debajo («Hierro(III)», «Cloruro»).
- Medidas ajustables: tamaño del dado (arista del cubo o del octaedro, arista larga del decaedro), tamaño y tipografía de las letras, profundidad o altura del texto, solapas, pliegues y separación entre los dos desarrollos.
- Los textos se leen derechos en el desarrollo y en el cubo plegado.

## Los tres dados
- **Cubo (6 caras)**: desarrollo en cruz; los textos se leen derechos al plegarlo.
```
          [arriba]
  [izq] [frente] [der] [fondo]
          [abajo]
```
- **Octaedro (8 triángulos equiláteros)** y **decaedro (trapezoedro pentagonal, 10 cometas)**: el desarrollo se despliega por un árbol de caras sin solapes y con una solapa en cada costura. Los árboles se buscaron con `node scripts/desarrollos.mjs 8|10` y están en `docs/poliedros.js`.
- En 3D cada dado se gira para apoyar en una cara y todo queda en coordenadas ≥ 0.

## Estructura
```
docs/
  index.html, app.js, style.css   interfaz
  iones.js                        iones, proporciones y nombres
  cara.js                         texto de una cara (fórmula, carga, nombre) y parámetros
  poliedros.js                    cubo, octaedro y decaedro: caras, ejes del texto, desarrollo y solapas
  dado.js                         texto de las caras, desarrollo de un dado y hoja con los dos dados
  svg.js                          hoja SVG para láser y vista previa
  stl.js                          mallas STL (binario) y ZIP
  geo.js                          polígonos (ClipperLib) y utilidades
  vendor/                         clipper.js, earcut.js
  fonts/                          Lexend, Atkinson Hyperlegible, Nunito, Montserrat
scripts/desarrollos.mjs           búsqueda de desarrollos planos (octaedro y decaedro)
tests/run.mjs                     poliedros, texto dentro de la cara, desarrollos sin solapes, SVG, mallas cerradas, volúmenes, ZIP
```

## Pruebas
`npm install && npm test` (devuelve «ok»).

Publicado con GitHub Pages desde la carpeta `docs/`.
