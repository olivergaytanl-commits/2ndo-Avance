const AJUSTES_DEFAULT = { musica: 70, efectos: 85 };

function leerAjustes() {
    try {
        return { ...AJUSTES_DEFAULT, ...JSON.parse(localStorage.getItem('ajustes')) };
    } catch {
        return { ...AJUSTES_DEFAULT };
    }
}

function guardarAjustes(a) {
    localStorage.setItem('ajustes', JSON.stringify(a));
}

const ajustes = leerAjustes();

const pistas = {
    menu: 'audio/handprints.mp3',
    oficinas: 'audio/nivel0.mp3',
    poolrooms: 'audio/poolrooms.mp3',
    fiesta: 'audio/funrooms.mp3'
};

// let (no const) porque ahora puede cambiar al entrar a un mapa
let pista = document.body.dataset.musica in pistas
    ? document.body.dataset.musica
    : 'menu';

const musica = new Audio(pistas[pista]);
musica.loop = true;
// antes: musica.volume = 0.4;
musica.volume = ajustes.musica / 100;

// si es la misma cancion se sigue reproduciendo y si no vuelve a empezar
let tiempoGuardado = 0;
if (sessionStorage.getItem('pista') === pista) {
    tiempoGuardado = parseFloat(sessionStorage.getItem('tiempo')) || 0;
} else {
    sessionStorage.setItem('pista', pista);
    sessionStorage.setItem('tiempo', 0);
}

// asignacion de tiempo solo cuando el audio ya cargó
musica.addEventListener('loadedmetadata', () => {
    if (tiempoGuardado > 0 && tiempoGuardado < musica.duration) {
        musica.currentTime = tiempoGuardado;
    }
});

// guardar el tiempo de la pista actual
function guardarTiempo() {
    if (musica.currentTime > 0) {
        sessionStorage.setItem('pista', pista);
        sessionStorage.setItem('tiempo', musica.currentTime);
    }
}

setInterval(() => { if (!musica.paused) guardarTiempo(); }, 300);
window.addEventListener('pagehide', guardarTiempo);
window.addEventListener('beforeunload', guardarTiempo);
document.addEventListener('click', guardarTiempo, true);

// suena de una, si el navegador lo bloquea tiene que esperar interacción
function iniciar() {
    musica.play().then(() => {
        document.removeEventListener('click', iniciar);
        document.removeEventListener('keydown', iniciar);
    }).catch(() => {});
}
iniciar();
document.addEventListener('click', iniciar);
document.addEventListener('keydown', iniciar);

// --- Cambiar de pista desde otro script (por ejemplo, al cargar un mapa) ---
function cambiarMusica(nombre) {
    if (!(nombre in pistas)) return;   // clave inválida: no hace nada
    if (nombre === pista) return;      // ya está sonando esa

    pista = nombre;
    tiempoGuardado = 0;                // evita que loadedmetadata retome un tiempo viejo

    musica.pause();
    musica.src = pistas[nombre];
    musica.currentTime = 0;
    musica.play().catch(() => {});

    sessionStorage.setItem('pista', nombre);
    sessionStorage.setItem('tiempo', 0);
}

const SONIDOS = {
    llaves:         'audio/llaves.mp3',
    velocidad:     'audio/velocidad.mp3',
    invisibilidad: 'audio/invisibilidad.mp3',
    escudo:        'audio/escudo.mp3',
    escudoRoto:    'audio/escudoroto.mp3'
};

// precarga para no tener retraso
Object.values(SONIDOS).forEach((ruta) => {
    const a = new Audio(ruta);
    a.preload = 'auto';
});

function sonido(nombre) {
    if (SONIDOS[nombre]) reproducirEfecto(SONIDOS[nombre]);
}
window.sonido = sonido;

function reproducirEfecto(ruta) {
    const s = new Audio(ruta);
    s.volume = leerAjustes().efectos / 100;
    s.play().catch(() => {});
}
window.reproducirEfecto = reproducirEfecto;

// por si tus scripts son type="module"
window.cambiarMusica = cambiarMusica;