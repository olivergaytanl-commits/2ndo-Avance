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
