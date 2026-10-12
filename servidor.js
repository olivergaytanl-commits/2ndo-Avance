const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// ───── Multijugador ─────
const jugadores = {};

io.on('connection', (socket) => {
  jugadores[socket.id] = { id: socket.id, x: 2, z: 2, rotY: 0 };

  socket.emit('init', { id: socket.id, jugadores });
  socket.broadcast.emit('jugadorNuevo', jugadores[socket.id]);

  socket.on('mover', ({ x, z, rotY }) => {
    if (![x, z, rotY].every(Number.isFinite)) return;
    Object.assign(jugadores[socket.id], { x, z, rotY });
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