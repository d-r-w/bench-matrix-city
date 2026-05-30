// Radar minimap — fixed screen-space overlay via orthographic camera
import * as THREE from "three";
import { fragmentShader, vertexShader } from "../shaders/radar.js";
import type { DroneUserData } from "../types.js";

const RADAR_NDC_Y = -0.56; // center Y in NDC (-1..+1), also controls left margin
const RADAR_RADIUS = 0.42;
const WORLD_RADIUS = 90; // how many world units the radar covers (half-width)

// ── Dying drone tracking ────────────────────────────────────────
interface DyingDrone {
  x: number;
  z: number;
  diedAt: number; // elapsed time when destroyed
}

const dyingDrones: DyingDrone[] = [];
const DYING_DISPLAY_TIME = 5.0; // seconds to show red X for destroyed drone

/** Record a drone's death position for radar display. */
export function recordDyingDrone(x: number, z: number, elapsed: number): void {
  dyingDrones.push({ x, z, diedAt: elapsed });
}

// ── Radar overlay (orthographic camera + separate scene) ────────
let radarScene: THREE.Scene | null = null;
let radarCamera: THREE.OrthographicCamera | null = null;
let radarMesh: THREE.Mesh | null = null;
const uniforms: Record<string, THREE.Uniform> = {};

// Reusable vector to avoid per-frame GC pressure
const _camForward = new THREE.Vector3();

// Track viewport aspect for correct circular scaling in ortho space
let viewportAspect = innerWidth / innerHeight;

// Exposed for main.ts to render on top of post-processing
export let getRadarOverlay:
  | (() => { scene: THREE.Scene; camera: THREE.OrthographicCamera })
  | null = null;

export function buildRadar(_mainScene: THREE.Scene): void {
  const geometry = new THREE.PlaneGeometry(1, 1);

  const maxBuildings = 256;
  const maxDrones = 12;
  const maxDying = 12;

  uniforms.uTime = new THREE.Uniform(0.0);
  uniforms.uRotation = new THREE.Uniform(0.0); // camera heading in radians
  uniforms.uWorldRadius = new THREE.Uniform(WORLD_RADIUS);

  uniforms.uBuildingPos = new THREE.Uniform(new Float32Array(maxBuildings * 4));
  uniforms.uBuildingCount = new THREE.Uniform(0);

  uniforms.uDroneData = new THREE.Uniform(new Float32Array(maxDrones * 3));
  uniforms.uDroneCount = new THREE.Uniform(0);

  uniforms.uDyingData = new THREE.Uniform(new Float32Array(maxDying * 3));
  uniforms.uDyingCount = new THREE.Uniform(0);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  radarMesh = new THREE.Mesh(geometry, material);
  radarMesh.renderOrder = 999;

  // Separate scene + orthographic camera for fixed screen-space overlay.
  // Frustum adjusted by aspect so a circle in world space looks circular on screen.
  radarScene = new THREE.Scene();
  const halfH = 1;
  const halfW = halfH * viewportAspect;
  radarCamera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0, 1);
  radarScene.add(radarMesh);

  getRadarOverlay = () => ({ scene: radarScene!, camera: radarCamera! });
  window._radar = radarMesh;
}

/** Update radar position (NDC) and shader uniforms each frame. */
export function updateRadar(camera: THREE.PerspectiveCamera, elapsed: number): void {
  if (!radarMesh || !radarScene || !radarCamera) return;

  // ── Fixed screen-space position (NDC coordinates) ────────
  const halfW = viewportAspect; // ortho camera right bound (= W/H)
  // Equal margin from left and bottom edges (in screen pixels):
  //   cx + halfW = cy + 1  →  cx = cy + 1 - halfW
  const ndcWidth = RADAR_RADIUS * 2;
  radarMesh.position.set(RADAR_NDC_Y + 1 - halfW, RADAR_NDC_Y, 0);
  radarMesh.scale.setScalar(ndcWidth);

  // ── Update uniforms ────────────────────────────────────────
  uniforms.uTime.value = elapsed;

  // Camera heading: angle of forward vector projected onto XZ plane
  camera.getWorldDirection(_camForward);
  const heading = Math.atan2(_camForward.x, _camForward.z);
  uniforms.uRotation.value = heading;

  // Camera-relative position: rotate world offsets into radar screen space.
  // rx = right component, rz = forward component (up on the minimap)
  const cosH = Math.cos(heading);
  const sinH = Math.sin(heading);

  // Buildings from window._buildingHeights (offset by camera, rotated)
  const buildings = window._buildingHeights ?? [];
  const bPosArr = uniforms.uBuildingPos.value as Float32Array;
  const maxBuildings = Math.min(buildings.length, 256);
  for (let i = 0; i < maxBuildings; i++) {
    const dx = buildings[i].x - camera.position.x;
    const dz = buildings[i].z - camera.position.z;
    // Rotate into camera-relative space (rx = right, rz = forward)
    const rx = -cosH * dx + sinH * dz;
    const rz = sinH * dx + cosH * dz;
    bPosArr[i * 4 + 0] = rx;
    bPosArr[i * 4 + 1] = rz;
    bPosArr[i * 4 + 2] = 0;
    bPosArr[i * 4 + 3] = 0;
  }
  uniforms.uBuildingCount.value = maxBuildings;

  // Active drones (offset by camera, rotated)
  const drones = window._policeDrones ?? [];
  const dDataArr = uniforms.uDroneData.value as Float32Array;
  for (let i = 0; i < Math.min(drones.length, 12); i++) {
    const drone = drones[i];
    const ud = drone.userData as DroneUserData;
    const dx = drone.position.x - camera.position.x;
    const dz = drone.position.z - camera.position.z;
    const rx = -cosH * dx + sinH * dz;
    const rz = sinH * dx + cosH * dz;
    dDataArr[i * 3 + 0] = rx;
    dDataArr[i * 3 + 1] = rz;
    // state: 0 = taking off, 1 = patrolling
    dDataArr[i * 3 + 2] = ud.isTakingOff ? 0 : 1;
  }
  uniforms.uDroneCount.value = Math.min(drones.length, 12);

  // Dying drones — purge old entries and upload remaining (offset by camera, rotated)
  for (let i = dyingDrones.length - 1; i >= 0; i--) {
    if (elapsed - dyingDrones[i].diedAt > DYING_DISPLAY_TIME) {
      dyingDrones.splice(i, 1);
    }
  }

  const dyDataArr = uniforms.uDyingData.value as Float32Array;
  for (let i = 0; i < Math.min(dyingDrones.length, 12); i++) {
    const dx = dyingDrones[i].x - camera.position.x;
    const dz = dyingDrones[i].z - camera.position.z;
    const rx = -cosH * dx + sinH * dz;
    const rz = sinH * dx + cosH * dz;
    dyDataArr[i * 3 + 0] = rx;
    dyDataArr[i * 3 + 1] = rz;
    dyDataArr[i * 3 + 2] = dyingDrones[i].diedAt;
  }
  uniforms.uDyingCount.value = Math.min(dyingDrones.length, 12);
}

/** Call on window resize to keep the orthographic frustum correct. */
export function updateRadarViewport(): void {
  if (!radarCamera) return;
  viewportAspect = innerWidth / innerHeight;
  const halfH = 1;
  const halfW = halfH * viewportAspect;
  radarCamera.left = -halfW;
  radarCamera.right = halfW;
  radarCamera.top = halfH;
  radarCamera.bottom = -halfH;
  radarCamera.updateProjectionMatrix();
}

/** Check if a mouse click (in CSS pixels from top-left) falls inside the radar circle. */
export function isInsideRadar(clientX: number, clientY: number): boolean {
  // Radar center in screen pixels — equal margin from left and bottom edges
  const marginPx = ((RADAR_NDC_Y + 1) * innerHeight) / 2;
  const radiusPx = (RADAR_RADIUS * innerHeight) / 2;
  return Math.hypot(clientX - marginPx, innerHeight - clientY - marginPx) < radiusPx;
}
