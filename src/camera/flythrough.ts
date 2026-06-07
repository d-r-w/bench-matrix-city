// Camera drone flythrough + manual steering + defense patrol mode
import * as THREE from "three";
import { CELL, GRID } from "../constants.js";
import type { BuildingHeight } from "../types.js";
import { ArcLengthCurve } from "./arc-length.js";

// ── Steering modes ────────────────────────────────────────────

export type SteeringMode = "normal" | "free" | "defense";

let currentMode: SteeringMode = "normal";

// ── Zoom mode (press Z to toggle) ─────────────────────────────
const BASE_FOV = 80;
const ZOOM_FOV = BASE_FOV / 3; // ~26.7° — 3× zoom
let zoomMode = false;
let reticleEl: HTMLDivElement | null = null;
let scanlineOverlay: HTMLDivElement | null = null;
let keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
const mouseScreen = { x: innerWidth / 2, y: innerHeight / 2 }; // raw pixel coords
const mouseNDC = { x: 0, y: 0 };
const freePos = new THREE.Vector3();
let freeYaw = 0;
let freePitch = 0;
const freeSpeed = 1; // world units / sec

// Defense mode state (set once when entering)
let defenseArcCurve: ArcLengthCurve | null = null;
let defenseDistance = 0;

// Shared flythrough speed in world units per second
const FLY_SPEED = 2; // world units / sec

export function getCurrentMode(): SteeringMode {
  return currentMode;
}

// ── Zoom toggle (Z key) ───────────────────────────────────────

function createReticle(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "zoom-reticle";
  el.style.cssText = `
    position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9999;
    width: 240px; height: 180px; transform: translate(-50%, -50%);
  `;

  const inner = document.createElement("div");
  inner.style.cssText = `
    position: relative; width: 240px; height: 180px;
  `;

  inner.innerHTML = `
    <svg viewBox="0 0 240 180" xmlns="http://www.w3.org/2000/svg">
      <!-- Corner brackets -->
      <polyline points="20,50 20,20 50,20"
        fill="none" stroke="#0f0" stroke-width="2.5" opacity="0.85"/>
      <polyline points="220,50 220,20 190,20"
        fill="none" stroke="#0f0" stroke-width="2.5" opacity="0.85"/>
      <polyline points="20,130 20,160 50,160"
        fill="none" stroke="#0f0" stroke-width="2.5" opacity="0.85"/>
      <polyline points="220,130 220,160 190,160"
        fill="none" stroke="#0f0" stroke-width="2.5" opacity="0.85"/>

      <!-- Center crosshair -->
      <line x1="120" y1="78" x2="120" y2="102"
        stroke="#0f0" stroke-width="1.5" opacity="0.6"/>
      <line x1="98" y1="90" x2="142" y2="90"
        stroke="#0f0" stroke-width="1.5" opacity="0.6"/>

      <!-- Center dot -->
      <circle cx="120" cy="90" r="2" fill="#0f0" opacity="0.7"/>

      <!-- Small tick marks on edges -->
      <line x1="120" y1="38" x2="120" y2="46"
        stroke="#0f0" stroke-width="1" opacity="0.4"/>
      <line x1="120" y1="134" x2="120" y2="142"
        stroke="#0f0" stroke-width="1" opacity="0.4"/>
      <line x1="78" y1="90" x2="86" y2="90"
        stroke="#0f0" stroke-width="1" opacity="0.4"/>
      <line x1="154" y1="90" x2="162" y2="90"
        stroke="#0f0" stroke-width="1" opacity="0.4"/>


    </svg>
  `;

  el.appendChild(inner);
  document.body.appendChild(el);
  return el;
}

function updateReticlePosition(): void {
  if (!reticleEl) return;

  reticleEl.style.left = `${mouseScreen.x}px`;
  reticleEl.style.top = `${mouseScreen.y}px`;

  // Scanlines follow the reticle
  if (scanlineOverlay) {
    scanlineOverlay.style.left = `${mouseScreen.x}px`;
    scanlineOverlay.style.top = `${mouseScreen.y}px`;
  }
}

const RETICLE_HALF_SCALE = 0.5;

function updateReticleScale(): void {
  if (!reticleEl) return;
  const scale = zoomMode ? 1 : RETICLE_HALF_SCALE;
  reticleEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

function toggleZoom(camera: THREE.PerspectiveCamera): void {
  zoomMode = !zoomMode;

  if (zoomMode) {
    camera.fov = ZOOM_FOV;
  } else {
    camera.fov = BASE_FOV;
  }
  camera.updateProjectionMatrix();
  updateReticleScale();
}

/** Wire up the Z-key zoom toggle. Call once after camera is created. */
export function setupZoomToggle(camera: THREE.PerspectiveCamera): void {
  keyDownHandler = (e: KeyboardEvent) => {
    if (e.key === "z" || e.key === "Z") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      toggleZoom(camera);
    }
  };
  document.addEventListener("keydown", keyDownHandler);

  // Full-screen scanlines crossing at the reticle position
  scanlineOverlay = document.createElement("div");
  scanlineOverlay.id = "scanline-overlay";
  scanlineOverlay.style.cssText = `
    position: fixed; top: 0; left: 0; pointer-events: none; z-index: 9998;
    width: 200vw; height: 200vh; transform: translate(-50%, -50%);
  `;
  scanlineOverlay.innerHTML = `
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
      <line x1="0" y1="50" x2="100" y2="50" stroke="#0f0" stroke-width="0.15" opacity="0.18"/>
      <line x1="50" y1="0" x2="50" y2="100" stroke="#0f0" stroke-width="0.15" opacity="0.18"/>
    </svg>
  `;
  document.body.appendChild(scanlineOverlay);

  // Reticle is always visible, cursor always hidden
  reticleEl = createReticle();
  updateReticleScale();
  updateReticlePosition();
  document.body.style.cursor = "none";

  // Track raw mouse position for reticle following
  const zoomMouseMove = (e: MouseEvent) => {
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    updateReticlePosition();
  };
  document.addEventListener("mousemove", zoomMouseMove);

  // Scroll wheel: up = zoom in, down = zoom out (no-op at limits)
  const zoomWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0 && !zoomMode) {
      // scroll up → zoom in
      toggleZoom(camera);
    } else if (e.deltaY > 0 && zoomMode) {
      // scroll down → zoom out
      toggleZoom(camera);
    }
  };
  document.addEventListener("wheel", zoomWheel, { passive: false });
}

// ── Steer button DOM wiring ───────────────────────────────────

let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

export function createSteerButton(camera: THREE.PerspectiveCamera): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = "steer-toggle";
  btn.textContent = "[ STEER ]";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (currentMode === "free") {
      currentMode = "normal";
      mouseNDC.x = 0;
      mouseNDC.y = 0;
    } else {
      // Enter free mode from either normal or defense
      currentMode = "free";
      freePos.copy(camera.position);

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      freeYaw = Math.atan2(-dir.x, -dir.z);
      freePitch = Math.asin(dir.y);

      if (!mouseMoveHandler) {
        mouseMoveHandler = (e: MouseEvent) => {
          mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
          mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
        };
        document.addEventListener("mousemove", mouseMoveHandler);
      }
    }

    btn.classList.toggle("active", currentMode === "free");
    btn.textContent = currentMode === "free" ? "[ FREE ]" : "[ STEER ]";
  });

  return btn;
}

// ── Defense button DOM wiring ─────────────────────────────────

export function createDefenseButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = "defense-toggle";
  btn.textContent = "[ DEFENSE ]";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (currentMode === "defense") {
      currentMode = "normal";
      mouseNDC.x = 0;
      mouseNDC.y = 0;
    } else {
      // Yaw/pitch capture handled via setDefenseYawPitch called from main.ts
      currentMode = "defense";

      if (!mouseMoveHandler) {
        mouseMoveHandler = (e: MouseEvent) => {
          mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
          mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
        };
        document.addEventListener("mousemove", mouseMoveHandler);
      }
    }

    btn.classList.toggle("active", currentMode === "defense");
  });

  return btn;
}

// ── Drone flythrough (normal + free + defense) ────────────────

/** Start the camera drone flythrough loop. */
export function startDroneFlythrough(
  camera: THREE.PerspectiveCamera,
  buildingHeights: BuildingHeight[]
): void {
  // ── Normal-mode waypoints ──────────────────────────────
  const waypoints: THREE.Vector3[] = [];

  const roadCenter = (idx: number) => idx * CELL;

  let segIdx = 0;
  function addSegment(
    fixedAxis: "x" | "z",
    fixedIdx: number,
    varyStart: number,
    varyEnd: number,
    step: number
  ): void {
    for (let v = varyStart; step > 0 ? v <= varyEnd : v >= varyEnd; v += step) {
      const h = 5 + ((Math.sin(segIdx * 0.3) + 1) / 2) * 30;
      segIdx++;
      if (fixedAxis === "x") {
        waypoints.push(new THREE.Vector3(roadCenter(fixedIdx), h, roadCenter(v)));
      } else {
        waypoints.push(new THREE.Vector3(roadCenter(v), h, roadCenter(fixedIdx)));
      }
    }
  }

  // Path: outer rectangle with inner detour through center
  addSegment("x", 0, -6, 4, 2);
  addSegment("z", 4, 0, 6, 2);
  addSegment("x", 6, 4, -6, -2);
  addSegment("z", -6, 6, -4, -2);
  addSegment("x", -4, -6, 0, 2);
  addSegment("z", 0, -4, 0, 2);
  addSegment("x", 0, 0, -6, -2);

  const normalArcCurve = new ArcLengthCurve(new THREE.CatmullRomCurve3(waypoints, true));
  let normalDistance = 0;

  // ── Defense-mode patrol path (around city perimeter) ───
  if (buildingHeights.length > 0) {
    let minX = Infinity,
      minZ = Infinity,
      maxX = -Infinity,
      maxZ = -Infinity,
      maxHeight = 0;

    for (const b of buildingHeights) {
      if (b.x < minX) minX = b.x;
      if (b.z < minZ) minZ = b.z;
      if (b.x > maxX) maxX = b.x;
      if (b.z > maxZ) maxZ = b.z;
      // h is the raw grid value; actual rendered height is h * 0.32
      const renderedH = b.h * 0.32;
      if (renderedH > maxHeight) maxHeight = renderedH;
    }

    const margin = CELL * 0.75; // tight buffer outside building cluster
    const patrolX0 = minX - margin;
    const patrolZ0 = minZ - margin;
    const patrolX1 = maxX + margin;
    const patrolZ1 = maxZ + margin;
    const patrolY = maxHeight * 1.5;

    const dPts: THREE.Vector3[] = [
      new THREE.Vector3(patrolX0, patrolY, patrolZ0), // SW
      new THREE.Vector3(patrolX1, patrolY, patrolZ0), // SE
      new THREE.Vector3(patrolX1, patrolY, patrolZ1), // NE
      new THREE.Vector3(patrolX0, patrolY, patrolZ1), // NW
    ];
    defenseArcCurve = new ArcLengthCurve(new THREE.CatmullRomCurve3(dPts, true));
  }

  // ── Shared smoothed state ───────────────────────────────
  const _posTarget = new THREE.Vector3();
  const _lookTarget = new THREE.Vector3();
  let smoothBank = 0;

  const halfGrid = (GRID / 2) * CELL;
  const _forward = new THREE.Vector3();

  // Defense-mode cursor raycast helpers (allocated once, reused per frame)
  const _defenseRaycaster = new THREE.Raycaster();
  const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
  const _cursorWorld = new THREE.Vector3();
  const _cityCenterFallback = new THREE.Vector3(0, 5, 0);
  const _mouseVec2 = new THREE.Vector2();

  let lastFlyTime = performance.now();

  function fly(): void {
    const now = performance.now();
    const dtSec = Math.min((now - lastFlyTime) / 1000, 0.1);
    lastFlyTime = now;

    if (currentMode === "free") {
      // ── Free flight: move forward in facing direction ──
      const steerRate = 1.8;
      freeYaw += -mouseNDC.x * steerRate * dtSec;
      freePitch += mouseNDC.y * steerRate * 0.6 * dtSec;
      freePitch = Math.max(-1.2, Math.min(1.2, freePitch));

      _forward.set(
        -Math.sin(freeYaw) * Math.cos(freePitch),
        Math.sin(freePitch),
        -Math.cos(freeYaw) * Math.cos(freePitch)
      );

      freePos.addScaledVector(_forward, freeSpeed * dtSec);

      // World bound bounce
      if (freePos.x > halfGrid) {
        freePos.x = halfGrid;
        freeYaw += Math.PI;
      } else if (freePos.x < -halfGrid) {
        freePos.x = -halfGrid;
        freeYaw += Math.PI;
      }
      if (freePos.z > halfGrid) {
        freePos.z = halfGrid;
        freeYaw += Math.PI;
      } else if (freePos.z < -halfGrid) {
        freePos.z = -halfGrid;
        freeYaw += Math.PI;
      }

      camera.position.copy(freePos);
      _lookTarget.copy(freePos).addScaledVector(_forward, 10);
      camera.lookAt(_lookTarget);

      const yawDelta = -mouseNDC.x * steerRate;
      smoothBank += (yawDelta * 0.15 - smoothBank) * 0.1;
      camera.rotateZ(smoothBank);
    } else if (currentMode === "defense" && defenseArcCurve) {
      // ── Defense mode: drone follows patrol path, camera orbits city center ──

      const totalLen = defenseArcCurve.length;
      defenseDistance = (defenseDistance + FLY_SPEED * dtSec) % totalLen;
      const f = defenseDistance / totalLen;

      // Drone position lerps toward patrol path point
      _posTarget.copy(defenseArcCurve.getPointAt(f));
      camera.position.lerp(_posTarget, 0.08);

      // Camera looks at the world point under the cursor (raycast onto ground plane y=0)
      _mouseVec2.set(mouseNDC.x, mouseNDC.y);
      _defenseRaycaster.setFromCamera(_mouseVec2, camera);
      const hit = _defenseRaycaster.ray.intersectPlane(_groundPlane, _cursorWorld);

      // Clamp look target to grid bounds so camera doesn't swing wildly off-map
      if (hit) {
        _cursorWorld.x = Math.max(-halfGrid, Math.min(halfGrid, _cursorWorld.x));
        _cursorWorld.z = Math.max(-halfGrid, Math.min(halfGrid, _cursorWorld.z));
      }

      // Lerp the look target smoothly so cursor movement feels controlled from altitude
      if (hit) {
        _lookTarget.lerp(_cursorWorld, 0.04);
      } else {
        _lookTarget.lerp(_cityCenterFallback, 0.04);
      }
      camera.lookAt(_lookTarget);

      // Subtle banking from path curvature
      smoothBank += (defenseArcCurve.getBankingAt(f, 0.3) - smoothBank) * 0.08;
      camera.rotateZ(smoothBank);
    } else {
      // ── Normal curve flythrough ──
      const totalLen = normalArcCurve.length;
      normalDistance = (normalDistance + FLY_SPEED * dtSec) % totalLen;
      const f = normalDistance / totalLen;

      _posTarget.copy(normalArcCurve.getPointAt(f));
      camera.position.lerp(_posTarget, 0.1);

      // Look-ahead along curve (advance by LOOK_AHEAD_DIST world units)
      const lookAheadDist = 8; // world units ahead
      const lookF = ((normalDistance + lookAheadDist) % totalLen) / totalLen;
      _lookTarget.lerp(normalArcCurve.getPointAt(lookF), 0.08);
      const midH = 20;
      if (camera.position.y > midH) {
        const excess = camera.position.y - midH;
        _lookTarget.y = camera.position.y - excess * 0.6;
      } else {
        _lookTarget.y = camera.position.y;
      }
      camera.lookAt(_lookTarget);

      // Banking from curve curvature
      smoothBank += (normalArcCurve.getBankingAt(f, 0.5) - smoothBank) * 0.1;
      camera.rotateZ(smoothBank);
    }

    requestAnimationFrame(fly);
  }

  fly();
}
