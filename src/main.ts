// Matrix City — orchestrator
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
// Camera
import { createSteerButton, startDroneFlythrough } from "./camera/flythrough.js";
// City
import { buildCity } from "./city/city-builder.js";
import { updateAntennas } from "./city/geometry/antenna.js";
import { updateWindowMeshes } from "./city/geometry/window-grid.js";
import { updateMatrixMesh } from "./city/instanced-mesh.js";
import { updateExplosions } from "./effects/explosion.js";
// Effects
import { buildGroundGrid, updateGroundGrid, updateStreamSprites } from "./effects/ground-grid.js";
import { buildHazeLayers, updateHazeLayers } from "./effects/haze-layers.js";
import { fireLaser, updateLasers } from "./effects/laser.js";
import { buildLightBeams, updateLightBeams } from "./effects/light-beams.js";
import { buildRain, updateRain } from "./effects/rain.js";
import { buildStarfield } from "./effects/starfield.js";
// Shaders
import {
  fragmentShader as vignetteFragment,
  vertexShader as vignetteVertex,
} from "./shaders/vignette.js";
import { checkAndRespawnDrones, updateDrones } from "./vehicles/drone-manager.js";
// Vehicles
import { updateVehicles } from "./vehicles/vehicle.js";

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
const clock = new THREE.Clock();

function init(): void {
  // ── Scene ────────────────────────────────────────────────
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000802, 0.004);
  scene.background = new THREE.Color(0x000301);

  // ── Lights ───────────────────────────────────────────────
  const ambLight = new THREE.AmbientLight(0x00ff41, 0.08);
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0x00aa30, 0.12);
  dirLight.position.set(0, 80, 0);
  scene.add(dirLight);

  const camLight = new THREE.PointLight(0x00ff41, 0.6, 35);
  scene.add(camLight);
  window._camLight = camLight;

  // ── Camera ───────────────────────────────────────────────
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(30, 25, 30);
  camera.lookAt(0, 10, 0);

  // ── Renderer ─────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  // ── Post-processing ──────────────────────────────────────
  const rp = new RenderPass(scene, camera);
  composer = new EffectComposer(renderer);

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.72, 0.038, 0.35);
  composer.addPass(rp);
  composer.addPass(bloom);

  const vignettePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      darkness: { value: 2.0 },
      offset: { value: 1.4 },
    },
    vertexShader: vignetteVertex,
    fragmentShader: vignetteFragment,
  });
  composer.addPass(vignettePass);

  // ── Build the city (includes vehicles + drones) ──────────
  const buildingHeights = buildCity(scene);
  window._buildingHeights = buildingHeights;

  // ── Scene effects ────────────────────────────────────────
  buildGroundGrid(scene);
  buildRain(scene);
  buildHazeLayers(scene);
  buildStarfield(scene);
  buildLightBeams(scene);

  // ── Camera flythrough + steer button ─────────────────────
  createSteerButton(camera);
  startDroneFlythrough(camera);

  // ── Store scene reference for laser module ───────────────
  (window as unknown as Record<string, THREE.Scene>).__matrixCityScene = scene;

  // ── Click to fire red laser ──────────────────────────────
  document.addEventListener("click", (e: MouseEvent) => {
    // Ignore clicks on UI elements (PiP overlays, steer button)
    const target = e.target as HTMLElement;
    if (
      target.closest(".pip-container") ||
      target.id === "steer-toggle" ||
      target.closest("#steer-toggle")
    ) {
      return;
    }

    // Convert click to NDC (-1..+1)
    const ndcX = (e.clientX / innerWidth) * 2 - 1;
    const ndcY = -(e.clientY / innerHeight) * 2 + 1;
    fireLaser(camera, ndcX, ndcY);
  });

  // ── Hide loading overlay ─────────────────────────────────
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";

  // ── Resize handler ───────────────────────────────────────
  addEventListener("resize", onResize);
}

function animate(): void {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.getElapsedTime();

  // Matrix character mesh (char refresh/decay animation)
  if (window._matrixInstancedMesh) {
    updateMatrixMesh(window._matrixInstancedMesh, dt, t);
  }

  // Ground grid time uniform
  updateGroundGrid(t);

  // Digital rain particles
  updateRain(dt, t);

  // Volumetric light beams
  updateLightBeams(dt, t);

  // Haze layers
  updateHazeLayers(t);

  // Flying vehicles
  updateVehicles(dt, t);

  // Police drones along patrol curves
  updateDrones(camera.position, dt, t);

  // Respawn destroyed drones after timeout
  checkAndRespawnDrones(scene, t);

  // Stream sprites on ground grid
  updateStreamSprites(dt, t);

  // Window grid time uniforms
  if (window._windowMeshes) {
    updateWindowMeshes(window._windowMeshes, t);
  }

  // Antenna blink lights
  if (window._antennaGroups) {
    updateAntennas(window._antennaGroups, t);
  }

  // Camera-following point light
  if (window._camLight) window._camLight.position.copy(camera.position);

  // Red laser beams
  updateLasers(dt, t);

  // Explosion / impact effects
  updateExplosions(dt, t);

  composer.render();
}

function onResize(): void {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
}

// ── Bootstrap ────────────────────────────────────────────────
try {
  init();
  animate();
} catch (e) {
  const loading = document.getElementById("loading");
  if (loading) loading.style.display = "none";
  const errorEl = document.getElementById("error");
  if (errorEl) {
    errorEl.textContent = `ERROR: ${(e as Error).message}`;
    errorEl.style.display = "block";
  }
  console.error("Matrix City initialization failed:", e);
}
