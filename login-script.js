// Inicio de sesión: guarda el nombre en la pestaña (sessionStorage), igual que el token del jugador.
// Así dos pestañas del mismo navegador pueden entrar con nombres distintos para probar el 1 vs 1.
const FB_APP_ID = '950902997612003';

const $ = (id) => document.getElementById(id);
const mensaje = (t) => { $('msg').textContent = t || ''; };

const limpiarNombre = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 20);

function guardarSesion(nombre, metodo) {
  sessionStorage.setItem('nombreJugador', nombre);
  sessionStorage.setItem('metodoLogin', metodo);
  try { localStorage.setItem('ultimoNombre', nombre); } catch {}
  window.location.href = 'index.html';
}

// Recuerda el último nombre usado
try { $('nombre').value = localStorage.getItem('ultimoNombre') || ''; } catch {}

// ───── solo nombre ─────
$('formulario').addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = limpiarNombre($('nombre').value);
  if (!nombre) { mensaje('ESCRIBE UN NOMBRE'); $('nombre').focus(); return; }
  guardarSesion(nombre, 'nombre');
});

// ───── Facebook ─────
let fbListo = false;
window.fbAsyncInit = function () {
  FB.init({ appId: FB_APP_ID, cookie: true, xfbml: false, version: 'v26.0' });
  fbListo = true;
};
(function (d, s, id) {
  if (d.getElementById(id)) return;
  const js = d.createElement(s); js.id = id;
  js.src = 'https://connect.facebook.net/es_LA/sdk.js';
  js.onerror = () => { fbListo = false; };
  d.getElementsByTagName(s)[0].parentNode.insertBefore(js, null);
}(document, 'script', 'facebook-jssdk'));

$('btnFacebook').addEventListener('click', () => {
  if (!fbListo || typeof FB === 'undefined') {
    return mensaje('FACEBOOK NO CARGÓ. REVISA TU CONEXIÓN O USA TU NOMBRE');
  }
  mensaje();
  $('btnFacebook').disabled = true;
  FB.login((r) => {
    if (!r.authResponse) {
      $('btnFacebook').disabled = false;
      return mensaje('INICIO CON FACEBOOK CANCELADO');
    }
    FB.api('/me', { fields: 'name' }, (perfil) => {
      const nombre = limpiarNombre(perfil && perfil.name);
      if (!nombre) {
        $('btnFacebook').disabled = false;
        return mensaje('NO SE PUDO LEER TU NOMBRE DE FACEBOOK');
      }
      guardarSesion(nombre, 'facebook');
    });
  }, { scope: 'public_profile' });
});
