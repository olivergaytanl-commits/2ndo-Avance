// Ranking real: viene de /api/scores (tabla "score" de la base de datos gcw)
const rows = document.getElementById('rows');

const formatoTiempo = (seg) =>
  `${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(seg % 60).padStart(2, '0')}`;

function fila(d, i) {
  const el = document.createElement('div');
  el.className = 'score-row' + (i < 3 ? ' top' : '');
  const celdas = [
    ['rank', String(d.ranking).padStart(3, '0')],
    ['name', d.nombre],               // textContent: el nombre nunca se interpreta como HTML
    ['time', formatoTiempo(d.tiempo)],
    ['level', d.dificultad],
  ];
  for (const [clase, texto] of celdas) {
    const span = document.createElement('span');
    span.className = clase;
    span.textContent = texto;
    el.appendChild(span);
  }
  return el;
}

function mensaje(texto) {
  const el = document.createElement('div');
  el.className = 'score-row';
  el.style.gridTemplateColumns = '1fr';
  el.style.textAlign = 'center';
  el.textContent = texto;
  rows.replaceChildren(el);
}

mensaje('CARGANDO...');
fetch('/api/scores')
  .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
  .then((lista) => {
    if (!lista.length) return mensaje('AÚN NADIE HA ESCAPADO');
    rows.replaceChildren(...lista.map(fila));
  })
  .catch(() => mensaje('NO SE PUDO CARGAR EL RANKING'));
