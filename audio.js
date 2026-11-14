const pista = document.body.dataset.musica || 'menu';

const pistas = {
    menu: 'audio/handprints.mp3',
    mapa: 'audio/mapa.mp3'
};

const musica = new Audio(pistas[pista]);
musica.loop = true;
musica.volume = 0.4;

// si es la misma cancion se sigue reproduciendo y si no vuelve a empezar
let tiempoGuardado = 0;
if (sessionStorage.getItem('pista') === pista) {
    tiempoGuardado = parseFloat(sessionStorage.getItem('tiempo')) || 0;
} else {
    sessionStorage.setItem('pista', pista);
    sessionStorage.setItem('tiempo', 0);
}

// asignacion de tiempo solo si el audio ya empezo
musica.addEventListener('loadedmetadata', () => {
    if (tiempoGuardado > 0 && tiempoGuardado < musica.duration) {
        musica.currentTime = tiempoGuardado;
    }
});

// guardar solo mientras se reproduce
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