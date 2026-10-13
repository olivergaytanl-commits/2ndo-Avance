const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Archivos del personaje: código (js/) y modelos 3D (.glb en modelos/)
app.use('/js', express.static(join(__dirname, 'js')));
app.use('/modelos', express.static(join(__dirname, 'modelos')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// ───── Multijugador ─────
const jugadores = {};

// Personajes disponibles = nombres de los .glb en modelos/ (sin la extensión)
const PERSONAJES = ['Bryce1', 'Martha1'];

// Elige el personaje que MENOS jugadores estén usando ahora mismo.
// Así los dos primeros jugadores nunca comparten skin, y cuando alguien se
// desconecta su personaje queda libre para el siguiente que entre.
// (Si hay más jugadores que personajes, se reparten parejo.)
function elegirPersonaje() {
  const uso = Object.fromEntries(PERSONAJES.map((p) => [p, 0]));
  for (const j of Object.values(jugadores)) uso[j.personaje]++;
  return PERSONAJES.reduce((mejor, p) => (uso[p] < uso[mejor] ? p : mejor));
}

io.on('connection', (socket) => {
  jugadores[socket.id] = { id: socket.id, x: 2, z: 2, rotY: 0, anim: 'Idle', personaje: elegirPersonaje() };
  console.log(`+ ${socket.id} -> ${jugadores[socket.id].personaje}`);

  // 'personaje' = el que le tocó a este jugador; 'jugadores' trae el de cada uno
  socket.emit('init', { id: socket.id, personaje: jugadores[socket.id].personaje, jugadores });
  socket.broadcast.emit('jugadorNuevo', jugadores[socket.id]);

  socket.on('mover', ({ x, z, rotY, anim }) => {
    if (![x, z, rotY].every(Number.isFinite)) return;
    if (!['Idle', 'Walk', 'Run'].includes(anim)) return;
    Object.assign(jugadores[socket.id], { x, z, rotY, anim });
    socket.broadcast.emit('estado', jugadores[socket.id]);
  });

  socket.on('disconnect', () => {
    delete jugadores[socket.id];
    io.emit('jugadorSalio', socket.id);
  });
});

server.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});