const data = [
  ["001", "SILENT.EXE", "01:42", "0-B"],
  ["002", "MARIA_K", "01:58", "0-A"],
  ["003", "ntlg", "02:05", "0-C"],
  ["004", "wanderer77", "02:11", "0-B"],
  ["005", "H.RIVERA", "02:19", "0-A"],
  ["006", "no.exit.found", "02:24", "0-D"],
  ["007", "diego_r", "02:30", "0-B"],
  ["008", "flicker", "02:37", "0-A"],
  ["009", "yellow.static", "02:45", "0-C"],
  ["010", "L.TORRES", "02:52", "0-B"],
];

const rows = document.getElementById('rows');

data.forEach((d, i) => {
  const el = document.createElement('div');
  el.className = 'score-row' + (i < 3 ? ' top' : '');
  el.innerHTML = `<span class="rank">${d[0]}</span><span class="name">${d[1]}</span><span class="time">${d[2]}</span><span class="level">NIVEL ${d[3]}</span>`;
  rows.appendChild(el);
});
