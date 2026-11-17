// Usa la base de datos MySQL "gcw". El servidor la crea sola si no existe.
// Si MySQL no está encendido, guarda en scores.json para que el juego no se caiga.
const fs = require('node:fs');
const { join } = require('node:path');

const CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345',
};
const BD = process.env.DB_NAME || 'gcw';
const ARCHIVO = join(__dirname, 'scores.json');

let pool = null;           // null = usando el archivo de respaldo
let listo = null;

async function iniciar() {
  try {
    const mysql = require('mysql2/promise');
    const base = await mysql.createConnection(CONFIG);
    await base.query(`CREATE DATABASE IF NOT EXISTS \`${BD}\` CHARACTER SET utf8mb4`);
    await base.end();
    pool = mysql.createPool({ ...CONFIG, database: BD, connectionLimit: 5 });
    await pool.query(`CREATE TABLE IF NOT EXISTS score (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ranking INT NOT NULL,
      nombre VARCHAR(50) NOT NULL,
      time_passed INT NOT NULL,
      Difficulty VARCHAR(50) NOT NULL
    ) DEFAULT CHARSET=utf8mb4`);
    console.log(`Ranking: MySQL (${CONFIG.host}, base "${BD}")`);
  } catch (e) {
    pool = null;
    console.warn(`Ranking: no se pudo usar MySQL (${e.code || e.message}). Se guardará en scores.json`);
  }
}
const asegurar = () => (listo ||= iniciar());

const leerArchivo = () => {
  try { return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')); } catch { return []; }
};

// Guarda una victoria. tiempo = segundos que tardó en escapar.
async function guardarScore({ nombre, tiempo, dificultad }) {
  await asegurar();
  nombre = String(nombre || 'ANÓNIMO').slice(0, 50);
  tiempo = Math.max(0, Math.round(tiempo));
  dificultad = String(dificultad).slice(0, 50);

  if (!pool) {
    const filas = leerArchivo();
    filas.push({ id: (filas.at(-1)?.id || 0) + 1, nombre, time_passed: tiempo, Difficulty: dificultad });
    fs.writeFileSync(ARCHIVO, JSON.stringify(filas, null, 2));
    return;
  }

  // "ranking" es NOT NULL, así que entra con 0 y enseguida se recalcula la posición de todos
  await pool.query('INSERT INTO score (ranking, nombre, time_passed, Difficulty) VALUES (0, ?, ?, ?)', [nombre, tiempo, dificultad]);
  try {
    await pool.query(`UPDATE score s JOIN (
        SELECT id, ROW_NUMBER() OVER (ORDER BY time_passed, id) AS pos FROM score
      ) r ON r.id = s.id SET s.ranking = r.pos`);
  } catch (e) {
    console.warn('No se pudo recalcular ranking:', e.message); // /api/scores ordena igual por tiempo
  }
}

// Mejores tiempos primero. La posición se calcula aquí, así no depende de la columna ranking.
async function obtenerScores(limite = 50) {
  await asegurar();
  let filas;
  if (pool) {
    [filas] = await pool.query('SELECT id, nombre, time_passed, Difficulty FROM score ORDER BY time_passed, id LIMIT ?', [limite]);
  } else {
    filas = leerArchivo().sort((a, b) => a.time_passed - b.time_passed || a.id - b.id).slice(0, limite);
  }
  return filas.map((f, i) => ({ ranking: i + 1, nombre: f.nombre, tiempo: f.time_passed, dificultad: f.Difficulty }));
}

module.exports = { guardarScore, obtenerScores, asegurar };
