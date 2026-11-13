// Entidad con modelo .glb (de Mixamo u otro) y sus animaciones
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const RUTA = '/modelos/Entidad.glb';   // cambia el nombre si tu archivo se llama distinto
const ALTURA = 2.3;                    // metros (los jugadores miden 1.8)

const loader = new GLTFLoader();
const cargar = (url) => new Promise((ok, mal) => loader.load(url, ok, undefined, mal));
const buscar = (clips, palabras) => clips.find((c) => palabras.some((p) => c.name.toLowerCase().includes(p)));

export async function crearEntidad(ruta = RUTA) {
  const gltf = await cargar(ruta);
  const modelo = gltf.scene;
  const clips = gltf.animations;
  console.log('[entidad] animaciones en ' + ruta + ':', clips.map((c) => c.name));

  // Tamaño: se mide el modelo y se escala a ALTURA; los pies quedan en el suelo
  modelo.updateMatrixWorld(true);
  const caja0 = new THREE.Box3().setFromObject(modelo, true);
  const alto = caja0.max.y - caja0.min.y;
  if (Number.isFinite(alto) && alto > 0.01) {
    modelo.scale.multiplyScalar(ALTURA / alto);
    modelo.updateMatrixWorld(true);
    modelo.position.y = -new THREE.Box3().setFromObject(modelo, true).min.y;
  }
  modelo.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });   // evita que desaparezca al animarse

  const raiz = new THREE.Group();
  raiz.add(modelo);

  // Las animaciones se buscan por nombre (Walk / Run / Idle); si solo hay una, se usa para todo
  const mixer = new THREE.AnimationMixer(modelo);
  const clipWalk = buscar(clips, ['walk', 'camin']) || clips[0];
  const clipRun = buscar(clips, ['run', 'corr', 'sprint']);
  const clipIdle = buscar(clips, ['idle', 'quiet', 'stand']);
  const acciones = {};
  if (clipWalk) acciones.Walk = mixer.clipAction(clipWalk);
  if (clipRun) acciones.Run = mixer.clipAction(clipRun);
  if (clipIdle) acciones.Idle = mixer.clipAction(clipIdle);

  let actual = null;
  function setEstado(nombre) {
    let a = acciones[nombre];
    let escala = 1;
    if (!a) {                        // si falta esa animación se usa la de caminar
      a = acciones.Walk;
      if (nombre === 'Run') escala = 1.8;
      if (nombre === 'Idle') escala = 0;   // quieta: caminar en pausa
    }
    if (!a) return;
    a.setEffectiveTimeScale(escala);
    if (a === actual) return;
    a.reset().setEffectiveTimeScale(escala).setEffectiveWeight(1).fadeIn(0.25).play();
    if (actual) actual.fadeOut(0.25);
    actual = a;
  }
  setEstado('Walk');

  return { raiz, mixer, setEstado };
}