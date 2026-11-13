const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const MAPAS = require('./mapas');
const { crearEntidades, actualizarEntidades, publica } = require('./entidad-ia');
const TAM = 2;   // igual que en el cliente

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static(__dirname, { index: false }));
app.use('/js', express.static(join(__dirname, 'js')));
app.use('/modelos', express.static(join(__dirname, 'modelos')));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));

// ───── Configuración de juego ─────
const PERSONAJES = ['Bryce1', 'Martha1'];
const MAX_JUGADORES = 2;
const GRACIA_MS = 8000; // tiempo para reconectar al cambiar de página

const MODOS = {
  carrera: { llaves: 3, entidades: 1 }, // 1v1
  coop: { llaves: 3, entidades: 2 },// cooperativo
};

const DIFICULTADES = {
  normal: {
    entidad: { velocidad: 2.5, rangoVision: 8, anguloVision: 70 },
    niebla: null,
  },
  dificil: {
    entidad: { velocidad: 3.6, rangoVision: 13, anguloVision: 100 },
    niebla: { color: '#14120b', densidad: 0.1 },
  },
};

const configValida = ({ modo, dificultad, mapa } = {}) =>
  MODOS[modo] && DIFICULTADES[dificultad] && MAPAS[mapa];

// ───── Estado ─────
const salas = {};      // codigo -> sala
const jugadores = {};  // token  -> jugador

const ack = (cb) => (typeof cb === 'function' ? cb : () => {});

// El cliente pide aquí la matriz del mapa de SU sala
app.get('/api/mapa', (req, res) => {
  const j = jugadores[req.query.token];
  const s = j && j.sala ? salas[j.sala] : null;
  const m = MAPAS[s ? s.mapa : 'oficinas'];
  res.json({ matriz: m.matriz, tema: m.tema });
});

function codigoNuevo() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do {
    c = '';
    for (let i = 0; i < 4; i++) c += L[Math.floor(Math.random() * L.length)];
  } while (salas[c]);
  return c;
}

function configDe(s) {
  return {
    modo: s.modo,
    dificultad: s.dificultad,
    mapa: s.mapa,
    ...MODOS[s.modo],
    entidad: DIFICULTADES[s.dificultad].entidad,
    niebla: DIFICULTADES[s.dificultad].niebla,
  };
}

// Azul = anfitrión (y todo el equipo en coop), rojo = invitado en carrera
const colorDe = (s, token) => (s.modo === 'coop' || s.anfitrion === token ? 'azul' : 'rojo');
// En coop el progreso es del equipo; en carrera, de cada jugador
const ordenDe = (s, j) => (s.modo === 'coop' ? s.progresoCoop : j.progresoOrden);
const subirOrden = (s, j) => { if (s.modo === 'coop') s.progresoCoop++; else j.progresoOrden++; };


function publicoJugador(j) {
  const { id, x, z, rotY, anim, personaje } = j;
  return { id, x, z, rotY, anim, personaje };
}

function publicoSala(s) {
  return {
    codigo: s.codigo,
    modo: s.modo,
    dificultad: s.dificultad,
    mapa: s.mapa,
    estado: s.estado,
    anfitrion: s.anfitrion,
    max: MAX_JUGADORES,
    jugadores: s.jugadores.map((t) => ({ id: t, personaje: jugadores[t].personaje })),
  };
}

const salaDe = (token) => {
  const j = jugadores[token];
  return j && j.sala ? salas[j.sala] : null;
};

const emitirSala = (s) => io.to(s.codigo).emit('salaActualizada', publicoSala(s));

function asignarPersonaje(s, j) {
  const usados = s.jugadores.filter((t) => t !== j.id).map((t) => jugadores[t].personaje);
  j.personaje = PERSONAJES.find((p) => !usados.includes(p)) || PERSONAJES[0];
}

function quitarDeSala(token) {
  const j = jugadores[token];
  if (!j || !j.sala) return;
  const s = salas[j.sala];
  j.sala = null;
  if (!s) return;
  io.sockets.sockets.get(j.socketId)?.leave(s.codigo);
  s.jugadores = s.jugadores.filter((t) => t !== token);
  io.to(s.codigo).emit('jugadorSalio', token);
  if (s.jugadores.length === 0) { delete salas[s.codigo]; return; }
  if (s.anfitrion === token) s.anfitrion = s.jugadores[0];
  emitirSala(s);
}

// ───── Sockets ─────
io.on('connection', (socket) => {
  let token = null;

  socket.on('identificar', (t, cb) => {
    cb = ack(cb);
    if (typeof t !== 'string' || t.length < 8 || t.length > 64) return;
    token = t;
    let j = jugadores[t];
    if (!j) {
      j = jugadores[t] = { id: t, x: 2, z: 2, rotY: 0, anim: 'Idle', personaje: null, sala: null, socketId: null, timer: null };
    }
    clearTimeout(j.timer);
    j.socketId = socket.id;
    const s = salaDe(t);
    if (s) socket.join(s.codigo);
    cb({ sala: s ? publicoSala(s) : null });
  });

  socket.on('crearSala', (cfg, cb) => {
    cb = ack(cb);
    const j = jugadores[token];
    if (!j) return cb({ error: 'No identificado' });
    if (!configValida(cfg)) return cb({ error: 'Configuración inválida' });
    quitarDeSala(token);
    const s = {
      codigo: codigoNuevo(), modo: cfg.modo, dificultad: cfg.dificultad, mapa: cfg.mapa,
      estado: 'espera', anfitrion: token, jugadores: [token],
    };
    salas[s.codigo] = s;
    asignarPersonaje(s, j);
    j.sala = s.codigo;
    socket.join(s.codigo);
    cb({ sala: publicoSala(s) });
  });

  socket.on('unirseSala', (codigo, cb) => {
    cb = ack(cb);
    const j = jugadores[token];
    if (!j) return cb({ error: 'No identificado' });
    const s = salas[String(codigo || '').toUpperCase().trim()];
    if (!s) return cb({ error: 'Esa sala no existe' });
    if (s.jugadores.includes(token)) return cb({ sala: publicoSala(s) });
    if (s.estado !== 'espera') return cb({ error: 'La partida ya empezó' });
    if (s.jugadores.length >= MAX_JUGADORES) return cb({ error: 'La sala está llena' });
    quitarDeSala(token);
    s.jugadores.push(token);
    asignarPersonaje(s, j);
    j.sala = s.codigo;
    socket.join(s.codigo);
    emitirSala(s);
    cb({ sala: publicoSala(s) });
  });

  socket.on('configurarSala', (cfg) => {
    const s = salaDe(token);
    if (!s || s.anfitrion !== token || s.estado !== 'espera') return;
    if (!configValida(cfg)) return;
    s.modo = cfg.modo;
    s.dificultad = cfg.dificultad;
    s.mapa = cfg.mapa;
    emitirSala(s);
  });

   socket.on('iniciarPartida', (_, cb) => {
    cb = ack(cb);
    const s = salaDe(token);
    if (!s || s.anfitrion !== token || s.estado !== 'espera') return cb({ error: 'No puedes iniciar' });
    if (s.jugadores.length < MAX_JUGADORES) return cb({ error: 'Falta un jugador' });
    s.estado = 'jugando';

    s.llaves = [];
    s.puertas = [];
    s.progresoCoop = 1;

    // Llaves y puertas salen del mapa elegido (mapas.js), así siempre caen en pasillos válidos
    const rutas = MAPAS[s.mapa].rutas;
    const armar = (ruta, color, desfase) => {
      ruta.llaves.forEach((p, i) => s.llaves.push({
        id: desfase + i, color, orden: i + 1, x: p.x, z: p.z, recogida: false,
      }));
      ruta.puertas.forEach((p, i) => s.puertas.push({
        id: desfase + i, color, orden: i + 1, x: p.x, z: p.z, ancho: p.ancho, largo: p.largo, abierta: false,
      }));
    };

    armar(rutas.azul, 'azul', 0);                          // coop: solo la ruta azul (compartida)
    if (s.modo !== 'coop') armar(rutas.rojo, 'rojo', 3);   // carrera: azul (anfitrión) y rojo (invitado)

    for (const t of s.jugadores) {
      Object.assign(jugadores[t], {
        x: 2, z: 2, rotY: 0, anim: 'Idle',
        llavesRecogidas: 0,
        progresoOrden: 1,
        listo: false, inmuneHasta: 0,
      });
    }
    s.entidades = crearEntidades(s.mapa, MAPAS[s.mapa], MODOS[s.modo].entidades);
    io.to(s.codigo).emit('partidaIniciada');
    cb({});
  });

    socket.on('recogerLlave', (llaveId) => {
    const j = jugadores[token];
    const s = salaDe(token);
    if (!j || !s || s.estado !== 'jugando') return;

    const llave = s.llaves.find((l) => l.id === llaveId && !l.recogida);
    if (!llave) return;
    if (llave.color !== colorDe(s, token)) return;     // solo las de tu color
    if (llave.orden !== ordenDe(s, j)) return;         // solo la que te toca
    if (Math.hypot(j.x - llave.x, j.z - llave.z) > 2) return;

    llave.recogida = true;
    io.to(s.codigo).emit('llaveRecogida', { id: llave.id, jugadorId: token, color: llave.color, orden: llave.orden });
  });

    socket.on('intentarAbrirPuerta', (puertaId) => {
    const j = jugadores[token];
    const s = salaDe(token);
    if (!j || !s || s.estado !== 'jugando') return;

    const p = s.puertas.find((d) => d.id === puertaId && !d.abierta);
    if (!p) return;
    if (p.color !== colorDe(s, token)) return;
    if (p.orden !== ordenDe(s, j)) return;

    // Debe tener ya la llave de esa etapa
    const llave = s.llaves.find((l) => l.color === p.color && l.orden === p.orden);
    if (!llave || !llave.recogida) return;
    if (Math.hypot(j.x - p.x, j.z - p.z) > 2.5) return;

    p.abierta = true;
    subirOrden(s, j);
    io.to(s.codigo).emit('puertaAbierta', { id: p.id, jugadorId: token, color: p.color, orden: p.orden });

    // La puerta 3 es la salida
    if (p.orden === 3) {
      s.estado = 'terminada';
      io.to(s.codigo).emit('finPartida', { modo: s.modo, ganador: s.modo === 'coop' ? null : token });
    }
  });

  socket.on('entrarJuego', (_, cb) => {
    cb = ack(cb);
    const s = salaDe(token);
    if (!s) return cb({ error: 'No hay sala asociada' });
    
    const j = jugadores[token];
    if (!j) return cb({ error: 'Jugador no encontrado' });

    // Asegurar que el socket esté en la sala de Socket.io
    if (!socket.rooms.has(s.codigo)) {
      socket.join(s.codigo);
    }

       cb({
      id: token,
      personaje: j.personaje,
      config: configDe(s),
      llaves: s.llaves,
      puertas: s.puertas,
      miColor: colorDe(s, token),
      miOrden: ordenDe(s, j),
      jugadores: Object.fromEntries(s.jugadores.map((t) => [t, publicoJugador(jugadores[t])])),
    });
    
    // Notificar a los demás que este jugador ya entró al juego activo
    socket.to(s.codigo).emit('jugadorNuevo', publicoJugador(j));
  });

  socket.on('mover', ({ x, z, rotY, anim }) => {
    const j = jugadores[token];
    const s = salaDe(token);
    if (!j || !s || s.estado !== 'jugando') return;
    if (![x, z, rotY].every(Number.isFinite)) return;
    if (!['Idle', 'Walk', 'Run'].includes(anim)) return;
    Object.assign(j, { x, z, rotY, anim });
    socket.to(s.codigo).emit('estado', publicoJugador(j));
  });

  socket.on('listo', () => {
    const j = jugadores[token];
    if (j) j.listo = true;
  });

  socket.on('salirSala', (_, cb) => {
    quitarDeSala(token);
    ack(cb)({});
  });

  socket.on('disconnect', () => {
    const j = jugadores[token];
    if (!j || j.socketId !== socket.id) return;
    j.timer = setTimeout(() => {
      quitarDeSala(token);
      delete jugadores[token];
    }, GRACIA_MS);
  });
});

// ───── Bucle de la Entidad ─────
let ultimoTick = Date.now();
setInterval(() => {
  const ahora = Date.now();
  const dt = Math.min((ahora - ultimoTick) / 1000, 0.1);
  ultimoTick = ahora;

  for (const s of Object.values(salas)) {
    if (s.estado !== 'jugando' || !s.entidades) continue;
    const mapa = MAPAS[s.mapa];
    const activos = s.jugadores.map((t) => jugadores[t]).filter((j) => j && j.listo);
    if (!activos.length) continue;

    actualizarEntidades(s.mapa, mapa, s.entidades, dt, activos, DIFICULTADES[s.dificultad].entidad, (j) => {
      j.x = mapa.inicio.col * TAM;     // te devuelve al inicio, con 4 s de inmunidad
      j.z = mapa.inicio.fila * TAM;
      j.inmuneHasta = Date.now() + 4000;
      io.to(s.codigo).emit('atrapado', { id: j.id, x: j.x, z: j.z });
    });
    io.to(s.codigo).volatile.emit('entidades', s.entidades.map(publica));
  }
}, 50);


server.listen(3000, () => console.log('server running at http://localhost:3000'));