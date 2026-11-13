const socket = io();

// Cada pestaña tiene su propio token: así el servidor reconoce al jugador
// aunque cambie de página (lobby -> laberinto) y se cree un socket nuevo.
let token = sessionStorage.getItem('idJugador');
if (!token) {
  token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  sessionStorage.setItem('idJugador', token);
}

const $ = (id) => document.getElementById(id);
const mensaje = (t) => { $('msg').textContent = t || ''; };
let sala = null;

// ───── Conexión ─────
socket.on('connect', () => {
  socket.emit('identificar', token, (r) => {
    if (!r || !r.sala) return mostrarInicio();
    if (r.sala.estado === 'jugando') window.location.href = 'laberinto.html';
    else mostrarSala(r.sala);
  });
});

// ───── Vistas ─────
function mostrarInicio() {
  sala = null;
  $('vistaInicio').classList.remove('oculto');
  $('vistaSala').classList.add('oculto');
}

function mostrarSala(s) {
  sala = s;
  const soyAnfitrion = s.anfitrion === token;

  $('vistaInicio').classList.add('oculto');
  $('vistaSala').classList.remove('oculto');
  $('codigoSala').textContent = s.codigo;

  // Solo el anfitrión puede cambiar modo, dificultad y mapa (el servidor también lo valida)
  $('selModo').value = s.modo;
  $('selDificultad').value = s.dificultad;
  $('selMapa').value = s.mapa;
  $('selModo').disabled = $('selDificultad').disabled = $('selMapa').disabled = !soyAnfitrion;

  // Lista de jugadores con tus clases de siempre
  let html = s.jugadores.map((j) => `
    <div class="player-row${j.id === token ? ' you' : ''}">
      <span class="name">${j.id === token ? 'TÚ' : 'JUGADOR'} · ${j.personaje}${j.id === s.anfitrion ? ' (ANFITRIÓN)' : ''}</span>
      <span class="status ready">LISTO</span>
    </div>`).join('');
  for (let i = s.jugadores.length; i < s.max; i++) {
    html += `
    <div class="player-row empty">
      <span class="name">ESPERANDO JUGADOR...</span>
      <span class="status waiting">—</span>
    </div>`;
  }
  $('players').innerHTML = html;

  $('flavor').textContent = `${s.jugadores.length} DE ${s.max} JUGADORES CONECTADOS`;

  // Solo el anfitrión ve "Iniciar", y solo se activa con la sala llena
  $('btnIniciar').style.display = soyAnfitrion ? '' : 'none';
  $('btnIniciar').disabled = s.jugadores.length < s.max;
}

// ───── Acciones ─────
$('btnCrear').addEventListener('click', () => {
  socket.emit('crearSala', {
    modo: $('selModoCrear').value,
    dificultad: $('selDificultadCrear').value,
    mapa: $('selMapaCrear').value,
  }, (r) => {
    if (r.error) return mensaje(r.error);
    mensaje(); mostrarSala(r.sala);
  });
});

$('btnUnirse').addEventListener('click', () => {
  socket.emit('unirseSala', $('inputCodigo').value, (r) => {
    if (r.error) return mensaje(r.error);
    mensaje(); mostrarSala(r.sala);
  });
});

$('inputCodigo').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnUnirse').click(); });

const cambioConfig = () => {
  if (sala) socket.emit('configurarSala', {
    modo: $('selModo').value,
    dificultad: $('selDificultad').value,
    mapa: $('selMapa').value,
  });
};
$('selModo').addEventListener('change', cambioConfig);
$('selDificultad').addEventListener('change', cambioConfig);
$('selMapa').addEventListener('change', cambioConfig);

$('btnIniciar').addEventListener('click', () => {
  socket.emit('iniciarPartida', null, (r) => { if (r.error) mensaje(r.error); });
});

$('btnSalir').addEventListener('click', () => {
  socket.emit('salirSala', null, () => { mensaje(); mostrarInicio(); });
});

// ───── Eventos del servidor ─────
socket.on('salaActualizada', mostrarSala);
socket.on('partidaIniciada', () => { window.location.href = 'laberinto.html'; });