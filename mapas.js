// Generador de laberintos con semilla: el mismo mapa sale siempre igual.
function rng(semilla) {
  return function () {
    semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const TAM = 2;   // igual que en el cliente

// Laberinto perfecto con el algoritmo de Prim: muchas ramas cortas y bifurcaciones (como un laberinto de papel).
// Sigue habiendo UN solo camino entre dos puntos, así una puerta en ese camino siempre bloquea.
function generar(cw, ch, semilla) {
  const R = rng(semilla);
  const H = ch * 2 + 1, W = cw * 2 + 1;
  const m = Array.from({ length: H }, () => Array(W).fill(1));
  m[1][1] = 0;

  const lista = [];   // paredes candidatas: [fila, col, df, dc]
  const agregar = (f, c) => {
    for (const [a, b] of D4) {
      const nf = f + 2 * a, nc = c + 2 * b;
      if (nf > 0 && nf < H - 1 && nc > 0 && nc < W - 1 && m[nf][nc] === 1) lista.push([f, c, a, b]);
    }
  };
  agregar(1, 1);

  while (lista.length) {
    const i = Math.floor(R() * lista.length);
    const [f, c, a, b] = lista[i];
    lista[i] = lista[lista.length - 1]; lista.pop();
    const nf = f + 2 * a, nc = c + 2 * b;
    if (m[nf][nc] !== 1) continue;
    m[f + a][c + b] = 0;
    m[nf][nc] = 0;
    agregar(nf, nc);
  }
  return m;
}

// Coloca llaves y puertas para la progresión:
// llave 1 -> puerta 1 -> llave 2 -> puerta 2 -> llave 3 -> puerta 3 (= la salida)
function crearRutas(m) {
  const H = m.length, W = m[0].length;
  const key = (f, c) => f * W + c;
  const desde = (k) => [Math.floor(k / W), k % W];
  const libre = (f, c) => f >= 0 && f < H && c >= 0 && c < W && m[f][c] === 0;
  const vecinos = (f, c) => D4.map(([a, b]) => [f + a, c + b]).filter(([a, b]) => libre(a, b));

  // Recorrido por anchura; 'bloq' = casillas que se tratan como pared
  function bfs(f0, c0, bloq = new Set()) {
    const dist = new Map([[key(f0, c0), 0]]), padre = new Map();
    const cola = [[f0, c0]];
    for (let i = 0; i < cola.length; i++) {
      const [f, c] = cola[i];
      for (const [nf, nc] of vecinos(f, c)) {
        const k = key(nf, nc);
        if (dist.has(k) || bloq.has(k)) continue;
        dist.set(k, dist.get(key(f, c)) + 1);
        padre.set(k, [f, c]);
        cola.push([nf, nc]);
      }
    }
    return { dist, padre };
  }

  const kIni = key(1, 1);
  const D0 = bfs(1, 1);

  // Callejones sin salida (casillas "de celda" con una sola vecina)
  const finales = [];
  for (let f = 1; f < H; f += 2) for (let c = 1; c < W; c += 2) {
    if (libre(f, c) && vecinos(f, c).length === 1 && key(f, c) !== kIni) finales.push(key(f, c));
  }
  finales.sort((a, b) => D0.dist.get(b) - D0.dist.get(a));

  // Salida del azul: el callejón más lejano. Salida del rojo: otro callejón lejano, apartado del primero.
  const salidaA = finales[0];
  const [fa, ca] = desde(salidaA);
  const DA = bfs(fa, ca);
  const maxD = D0.dist.get(salidaA);
  const salidaB = finales
    .filter((k) => k !== salidaA && D0.dist.get(k) >= maxD * 0.6)
    .sort((a, b) => DA.dist.get(b) - DA.dist.get(a))[0] ?? finales[1];

  const usadasPuertas = new Set();
  const usadasLlaves = new Set([salidaA, salidaB]);

  const aMundo = (k) => { const [f, c] = desde(k); return { x: c * TAM, z: f * TAM }; };
    // Ancho libre de un pasillo: de pared a pared (4 entre centros, menos el grosor de la pared)
  const ANCHO_PASILLO = TAM * 2 - 0.2;   // 3.8

  const aPuerta = (k) => {
    const [f, c] = desde(k);
    const viajaEnX = libre(f, c - 1) && libre(f, c + 1);
    return {
      x: c * TAM, z: f * TAM,
      ancho: viajaEnX ? 0.3 : ANCHO_PASILLO,
      largo: viajaEnX ? ANCHO_PASILLO : 0.3,
    };
  };

  function ruta(salida, fracs) {
    // Camino único inicio -> salida
    const camino = [];
    for (let k = salida; k !== kIni; ) { camino.push(k); const [pf, pc] = D0.padre.get(k); k = key(pf, pc); }
    camino.push(kIni); camino.reverse();
    const n = camino.length;

    // Las puertas van en casillas "de paso" (índices impares): siempre es un tramo recto entre dos paredes
    const idx = fracs.map((fr) => {
      let i = Math.round(fr * (n - 1));
      if (i % 2 === 0) i++;
      while (usadasPuertas.has(camino[i])) i += 2;
      return Math.min(i, n - 4);
    });
    idx.push(n - 2);   // puerta 3: justo antes de la salida
    const puertasK = idx.map((i) => camino[i]);
    puertasK.forEach((k) => usadasPuertas.add(k));

    // Zonas: 1 = antes de la puerta 1, 2 = entre puertas 1 y 2, 3 = el resto antes de la salida
    const entradas = [kIni, puertasK[0], puertasK[1]];
    let previa = new Set();
    const llavesK = [0, 1, 2].map((i) => {
      const alcanzable = bfs(1, 1, new Set([puertasK[i]])).dist;
      const zona = new Set([...alcanzable.keys()].filter((k) => !previa.has(k)));
      previa = new Set(alcanzable.keys());
      const [ef, ec] = desde(entradas[i]);
      const { dist } = bfs(ef, ec);
      let cand = finales.filter((k) => zona.has(k) && !usadasLlaves.has(k));
      if (!cand.length) cand = [...zona].filter((k) => !usadasLlaves.has(k) && !usadasPuertas.has(k));
      cand.sort((a, b) => dist.get(b) - dist.get(a));
      usadasLlaves.add(cand[0]);
      return cand[0];
    });

    return { llaves: llavesK.map(aMundo), puertas: puertasK.map(aPuerta) };
  }

  return { azul: ruta(salidaA, [0.30, 0.62]), rojo: ruta(salidaB, [0.34, 0.66]) };
}

function crearMapa(nombre, tema, cw, ch, semilla) {
  const matriz = generar(cw, ch, semilla);
  return { nombre, tema, matriz, inicio: { fila: 1, col: 1 }, rutas: crearRutas(matriz) };
}

module.exports = {
  oficinas:  crearMapa('OFICINAS', 'oficinas', 20, 20, 7),     // 41 x 41
  poolrooms: crearMapa('POOLROOMS', 'poolrooms', 24, 24, 22),  // 49 x 49
  fiesta:    crearMapa('FIESTA', 'fiesta', 26, 20, 33),        // 53 x 41
};