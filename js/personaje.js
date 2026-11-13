// ============================================================
//  PERSONAJE (modelo .glb de Mixamo con animaciones Idle / Walk / Run)
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- Ajustes ----------
const ALTURA_MODELO = 1.75;      // metros; solo se usa si el modelo viene con escala rara
const ROTACION_MODELO = 0;       // pon Math.PI si el personaje camina "de espaldas"
const FADE = 0.2;                // segundos de transición entre animaciones
const VEL_ANIM = { Idle: 1, Walk: 1.4, Run: 1.2 }; // velocidad de reproducción (ajustar si "patina")
const QUITAR_ROOT_MOTION = true; // evita que Walk/Run desplacen al personaje por sí solos

// Si un clip trae movimiento de la cadera hacia adelante (root motion),
// deja la cadera quieta en esos ejes. Si ya es "In Place", no hace nada.
function quitarMovimientoRaiz(clip) {
  for (const track of clip.tracks) {
    if (!/hips\.position$/i.test(track.name)) continue;
    const v = track.values, n = v.length / 3;
    for (let eje = 0; eje < 3; eje++) {
      const primero = v[eje], ultimo = v[(n - 1) * 3 + eje];
      if (Math.abs(ultimo - primero) > 0.2) {
        for (let i = 0; i < n; i++) v[i * 3 + eje] = primero;
      }
    }
  }
}

export function cargarPersonaje(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => {
      const modelo = gltf.scene;
      modelo.rotation.y = ROTACION_MODELO;

      // Los meshes con esqueleto a veces se "desaparecen" por un cálculo de caja incorrecto
      modelo.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; });

      // Comprobar tamaño: si no mide ~1.2–2.4 m, lo escalamos a ALTURA_MODELO
      modelo.updateMatrixWorld(true);
      const caja = new THREE.Box3().setFromObject(modelo);
      const alto = caja.max.y - caja.min.y;
      console.log(`[personaje] altura medida: ${alto.toFixed(2)} m`);
      if (alto > 0 && (alto < 1.2 || alto > 2.4)) {
        modelo.scale.multiplyScalar(ALTURA_MODELO / alto);
        console.log('[personaje] escala corregida automáticamente');
      }

      // "raiz" es lo que se mueve/gira en el mundo; "modelo" va dentro
      const raiz = new THREE.Group();
      raiz.add(modelo);

      // Animaciones por nombre
      const mixer = new THREE.AnimationMixer(modelo);
      const acciones = {};
      for (const clip of gltf.animations) {
        const nombre = ['Idle', 'Walk', 'Run'].find(n => n.toLowerCase() === clip.name.trim().toLowerCase());
        if (!nombre) continue;
        if (QUITAR_ROOT_MOTION) quitarMovimientoRaiz(clip);
        acciones[nombre] = mixer.clipAction(clip);
      }
      for (const n of ['Idle', 'Walk', 'Run'])
        if (!acciones[n]) console.warn(`[personaje] falta la animación "${n}". Encontradas:`, gltf.animations.map(a => a.name));

      let actual = null;
      function setEstado(nombre) {
        const siguiente = acciones[nombre];
        if (!siguiente || siguiente === actual) return;
        siguiente.reset().setEffectiveTimeScale(VEL_ANIM[nombre]).setEffectiveWeight(1).play();
        if (actual) siguiente.crossFadeFrom(actual, FADE, false);
        actual = siguiente;
      }

      // Gira suavemente hacia un ángulo (por el camino más corto)
      function girarHacia(angulo, dt) {
        let d = angulo - raiz.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        raiz.rotation.y += d * Math.min(1, dt * 12);
      }

      setEstado('Idle');
      resolve({ raiz, mixer, setEstado, girarHacia });
    }, undefined, reject);
  });
}
