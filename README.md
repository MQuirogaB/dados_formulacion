# Dados de formulación · STL y SVG

Generador de **dados para aprender formulación y nomenclatura**: un dado de cationes y otro de aniones, con un ion en cada cara. Tiras los dos y formulas el compuesto que sale. Eliges el ion de cada una de las 6 caras (o rellenas el dado al azar) y descargas:

- **STL** de cada cubo para imprimir en 3D: texto hundido, en relieve, o hundido con las letras aparte para imprimirlas de otro color (con dos archivos, ZIP).
- **SVG** con el desarrollo plano en cruz de cada dado para láser: contorno de corte en rojo, letras en negro (grabado), pliegues en azul discontinuo y solapas de pegado opcionales.

Todo ocurre en el navegador; no se sube nada a ningún servidor.

## Qué incluye
- Lista larga de iones monoatómicos (`docs/iones.js`, la misma que el puzle de formulación): ~45 cationes y ~17 aniones. Los poliatómicos están en la lista con `binario: false`, preparados para la siguiente fase.
- Cada cara lleva la fórmula grande y centrada con la carga en superíndice (Fe³⁺, O₂²⁻…) y, si quieres, el nombre debajo («Hierro(III)», «Cloruro»).
- Medidas ajustables: arista del cubo, tamaño y tipografía de las letras, profundidad o altura del texto, solapas, pliegues y separación entre los dos desarrollos.
- Los textos se leen derechos en el desarrollo y en el cubo plegado.

## Desarrollo en cruz
```
          [arriba]
  [izq] [frente] [der] [fondo]
          [abajo]
```
Las caras se numeran en ese orden. En 3D, el cubo ocupa de 0 a L en los tres ejes (con relieve, el cubo se desplaza para que nada quede por debajo de 0).

## Estructura
```
docs/
  index.html, app.js, style.css   interfaz
  iones.js                        iones, proporciones y nombres
  cara.js                         texto de una cara (fórmula, carga, nombre) y parámetros
  cubo.js                         desarrollo en cruz, solapas, caras y hoja con los dos dados
  svg.js                          hoja SVG para láser y vista previa
  stl.js                          mallas STL (binario) y ZIP
  geo.js                          polígonos (ClipperLib) y utilidades
  vendor/                         clipper.js, earcut.js
  fonts/                          Lexend, Atkinson Hyperlegible, Nunito, Montserrat
tests/run.mjs                     orientación de las caras, texto dentro de la cara, desarrollo, SVG, mallas cerradas, volúmenes, ZIP
```

## Pruebas
`npm install && npm test` (devuelve «ok»).

Publicado con GitHub Pages desde la carpeta `docs/`.
