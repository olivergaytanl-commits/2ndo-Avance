// IA de la Entidad: patrulla por el laberinto, te ve (distancia + ángulo + línea de vista) y te persigue.
// Se simula en el servidor para que los dos jugadores vean la misma Entidad en el mismo lugar.
const TAM = 2;                 // igual que en el cliente
const GROSOR = 0.4;            // grosor de las paredes (igual que en el cliente)
const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const RADIO_SENTIDO = 2.5;     // a esta distancia te nota aunque estés a su espalda (si no hay pared en medio)
const RADIO_CAPTURA = 1.0;     // a esta distancia te atrapa
const FACTOR_PATRULLA = 0.55;  // patrullando va al 55 % de su velocidad
const FACTOR_INVESTIGAR = 0.8; // yendo a donde te vio por última vez
const VEL_GIRO = 10;           // rad/s
const ESPERA_BUSCAR = 3;       // segundos mirando alrededor cuando te pierde

const cache = new Map();

// Prepara (una vez por mapa) lo que la IA necesita: paredes, línea de vista y rutas
function navegacion(id, matriz) {
  if (cache.has(id)) return cache.get(id);
  const H = matriz.length, W = matriz[0].length;
  const libre = (f, c) => f >= 0 && f < H && c >= 0 && c < W && matriz[f][c] === 0;

  // Las mismas paredes delgadas que dibuja el cliente, agrupadas por casilla
  const cajas = new Map();
  const poner = (f, c, caja) => {
    const k = f * W + c;
    if (!cajas.has(k)) cajas.set(k, []);
    cajas.get(k).push(caja);
  };
  for (let f = 0; f < H; f++) for (let c = 0; c < W; c++) {
    if (matriz[f][c] !== 1) continue;
    const x = c * TAM, z = f * TAM;
    poner(f, c, { x, z, mx: GROSOR / 2, mz: GROSOR / 2 });
    if (matriz[f][c + 1] === 1) poner(f, c, { x: x + TAM / 2, z, mx: (TAM - GROSOR) / 2, mz: GROSOR / 2 });
    if (matriz[f + 1] && matriz[f + 1][c] === 1) poner(f, c, { x, z: z + TAM / 2, mx: GROSOR / 2, mz: (TAM - GROSOR) / 2 });
  }

  const hayPared = (x, z) => {
    const f0 = Math.round(z / TAM), c0 = Math.round(x / TAM);
    for (let f = f0 - 1; f <= f0 + 1; f++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (f < 0 || f >= H || c < 0 || c >= W) continue;
      const lista = cajas.get(f * W + c);
      if (!lista) continue;
      for (const b of lista) if (Math.abs(x - b.x) < b.mx && Math.abs(z - b.z) < b.mz) return true;
    }
    return false;
  };

  // ¿Hay línea de vista entre dos puntos? (se recorre el segmento buscando paredes)
  const lineaLibre = (x1, z1, x2, z2) => {
    const pasos = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.2));
    for (let i = 1; i < pasos; i++) {
      const t = i / pasos;
      if (hayPared(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  };

  // Ruta más corta entre dos casillas, como lista de puntos del mundo
  const ruta = (f0, c0, f1, c1) => {
    if (f0 === f1 && c0 === c1) return [];
    const ini = f0 * W + c0, fin = f1 * W + c1;
    const prev = new Map([[ini, -1]]);
    const cola = [ini];
    for (let i = 0; i < cola.length; i++) {
      const k = cola[i];
      if (k === fin) break;
      const f = Math.floor(k / W), c = k % W;
      for (const [a, b] of D4) {
        if (!libre(f + a, c + b)) continue;
        const nk = (f + a) * W + (c + b);
        if (prev.has(nk)) continue;
        prev.set(nk, k);
        cola.push(nk);
      }
    }
    if (!prev.has(fin)) return [];
    const camino = [];
    for (let k = fin; k !== ini; k = prev.get(k)) camino.push({ x: (k % W) * TAM, z: Math.floor(k / W) * TAM });
    return camino.reverse();
  };

  const celdas = [];   // casillas "de celda" (las de paso quedan entre ellas)
  for (let f = 1; f < H; f += 2) for (let c = 1; c < W; c += 2) if (libre(f, c)) celdas.push({ f, c });

  const nav = { W, H, celdas, hayPared, lineaLibre, ruta };
  cache.set(id, nav);
  return nav;
}

// Crea las Entidades de una partida, lejos del inicio y separadas entre sí
function crearEntidades(mapaId, mapa, cantidad) {
  const nav = navegacion(mapaId, mapa.matriz);
  const ix = mapa.inicio.col * TAM, iz = mapa.inicio.fila * TAM;
  const diag = Math.hypot(nav.W * TAM, nav.H * TAM);
  const lejos = nav.celdas.filter((c) => Math.hypot(c.c * TAM - ix, c.f * TAM - iz) > diag * 0.45);
  const base = lejos.length ? lejos : nav.celdas;

  const lista = [];
  for (let i = 0; i < cantidad; i++) {
    const aparte = base.filter((c) => lista.every((e) => Math.hypot(c.c * TAM - e.x, c.f * TAM - e.z) > diag * 0.3));
    const pool = aparte.length ? aparte : base;
    const c = pool[Math.floor(Math.random() * pool.length)];
    lista.push({
      id: 'e' + i, x: c.c * TAM, z: c.f * TAM, rotY: 0,
      estado: 'patrulla',   // patrulla | persecucion | investigar | buscar
      objetivo: null, ruta: [], ultima: null, espera: 0,
    });
  }
  return lista;
}

function girarHacia(e, angulo, dt) {
  const d = Math.atan2(Math.sin(angulo - e.rotY), Math.cos(angulo - e.rotY));
  const paso = VEL_GIRO * dt;
  e.rotY += Math.max(-paso, Math.min(paso, d));
}

// Avanza por la ruta. Devuelve true si llegó a algún punto de la ruta en este tick.
function seguirRuta(e, vel, dt) {
  let resta = vel * dt, llego = false;
  while (resta > 0 && e.ruta.length) {
    const p = e.ruta[0];
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
    if (d > 1e-6) girarHacia(e, Math.atan2(dx, dz), dt);
    if (d <= resta) { e.x = p.x; e.z = p.z; resta -= d; e.ruta.shift(); llego = true; }
    else { e.x += (dx / d) * resta; e.z += (dz / d) * resta; resta = 0; }
  }
  return llego;
}

const celdaDe = (x, z) => [Math.round(z / TAM), Math.round(x / TAM)];

function actualizarUna(e, dt, nav, cfg, jugadores, ahora, alCapturar) {
  const fx = Math.sin(e.rotY), fz = Math.cos(e.rotY);
  const mitad = (cfg.anguloVision / 2) * Math.PI / 180;
  const persiguiendo = e.estado === 'persecucion';

  // ── 1. Ver: distancia, ángulo de visión y línea de vista sin paredes ──
  let visto = null, mejor = Infinity;
  for (const j of jugadores) {
    if (j.inmuneHasta > ahora) continue;
    const dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz);
    if (d > cfg.rangoVision * (persiguiendo ? 1.2 : 1)) continue;
    if (!persiguiendo && d > RADIO_SENTIDO) {   // persiguiendo te ve en 360°; si no, solo dentro de su cono
      const cos = (dx * fx + dz * fz) / d;
      if (Math.acos(Math.max(-1, Math.min(1, cos))) > mitad) continue;
    }
    if (!nav.lineaLibre(e.x, e.z, j.x, j.z)) continue;
    if (d < mejor) { mejor = d; visto = j; }
  }

  // ── 2. Atrapar ──
  if (visto && mejor < RADIO_CAPTURA) {
    alCapturar(visto, e);
    e.estado = 'buscar'; e.espera = ESPERA_BUSCAR; e.ruta = []; e.objetivo = null;
    return;
  }

  // ── 3. Cambiar de estado ──
  if (visto) {
    if (e.estado !== 'persecucion') e.ruta = [];
    e.estado = 'persecucion';
    e.objetivo = visto.id;
    e.ultima = { x: visto.x, z: visto.z };
  } else if (e.estado === 'persecucion') {
    e.estado = 'investigar';   // te perdió: va a donde te vio por última vez
    e.objetivo = null;
    e.ruta = [];
  }

  // ── 4. Actuar según el estado ──
  switch (e.estado) {
    case 'persecucion': {
      if (!e.ruta.length) {
        const [f0, c0] = celdaDe(e.x, e.z), [f1, c1] = celdaDe(e.ultima.x, e.ultima.z);
        e.ruta = nav.ruta(f0, c0, f1, c1);
        if (!e.ruta.length && visto) e.ruta = [{ x: visto.x, z: visto.z }];   // misma casilla: directo hacia ti
      }
      if (seguirRuta(e, cfg.velocidad, dt)) e.ruta = [];   // al llegar a cada casilla vuelve a calcular
      break;
    }
    case 'investigar': {
      if (!e.ruta.length) {
        const [f0, c0] = celdaDe(e.x, e.z), [f1, c1] = celdaDe(e.ultima.x, e.ultima.z);
        e.ruta = nav.ruta(f0, c0, f1, c1);
      }
      seguirRuta(e, cfg.velocidad * FACTOR_INVESTIGAR, dt);
      if (!e.ruta.length) { e.estado = 'buscar'; e.espera = ESPERA_BUSCAR; }
      break;
    }
    case 'buscar': {
      e.espera -= dt;
      e.rotY += 2.5 * dt;   // gira sobre sí misma mirando alrededor
      if (e.espera <= 0) { e.estado = 'patrulla'; e.ruta = []; }
      break;
    }
    default: {   // patrulla
      if (!e.ruta.length) {
        const [f0, c0] = celdaDe(e.x, e.z);
        for (let i = 0; i < 5 && e.ruta.length < 6; i++) {
          const d = nav.celdas[Math.floor(Math.random() * nav.celdas.length)];
          e.ruta = nav.ruta(f0, c0, d.f, d.c);
        }
      }
      seguirRuta(e, cfg.velocidad * FACTOR_PATRULLA, dt);
    }
  }
}

// Un paso de la simulación para todas las Entidades de una sala
function actualizarEntidades(mapaId, mapa, entidades, dt, jugadores, cfg, alCapturar) {
  const nav = navegacion(mapaId, mapa.matriz);
  const ahora = Date.now();
  for (const e of entidades) actualizarUna(e, dt, nav, cfg, jugadores, ahora, alCapturar);
}

// Lo que se envía a los clientes
const publica = ({ id, x, z, rotY, estado, objetivo }) => ({
  id, x: +x.toFixed(2), z: +z.toFixed(2), rotY: +rotY.toFixed(3), estado, objetivo,
});

module.exports = { crearEntidades, actualizarEntidades, publica };