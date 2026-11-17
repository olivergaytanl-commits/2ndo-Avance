// Sin sesión no hay menú: primero hay que iniciar sesión
const nombreJugador = sessionStorage.getItem('nombreJugador');
if (!nombreJugador) {
  window.location.replace('login.html');
} else {
  document.getElementById('nombreJugador').textContent = nombreJugador;
}

document.getElementById('btnCambiar').addEventListener('click', () => {
  sessionStorage.removeItem('nombreJugador');
  sessionStorage.removeItem('metodoLogin');
  window.location.href = 'login.html';
});

// contador de jugadores conectados, puramente decorativo
document.getElementById('pc').textContent = Math.floor(Math.random() * 3) + 1;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Control') {
    window.location.href = 'settings.html';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.open('', '_self');
    window.close();
  }
});
