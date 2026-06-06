// Camera drone flythrough + manual steering + defense patrol mode
import * as THREE from "three";
import { CELL, GRID } from "../constants.js";
import type { BuildingHeight } from "../types.js";

// ── Steering modes ────────────────────────────────────────────

export type SteeringMode = "normal" | "free" | "defense";

let currentMode: SteeringMode = "normal";
const mouseNDC = { x: 0, y: 0 };
const freePos = new THREE.Vector3();
let freeYaw = 0;
let freePitch = 0;
const freeSpeed = 1; // world units / sec

// Defense mode state (set once when entering)
let defenseCurve: THREE.CatmullRomCurve3 | null = null;
let defenseT = 0;
const defenseSpeed = 0.00025; // curve param speed

export function getCurrentMode(): SteeringMode {
  return currentMode;
}

// ── Steer button DOM wiring ───────────────────────────────────

let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

export function createSteerButton(camera: THREE.PerspectiveCamera): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = "steer-toggle";
  btn.textContent = "[ STEER ]";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (currentMode === "defense") return; // ignore while in defense mode

    if (currentMode === "normal") {
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
    } else {
      currentMode = "normal";
      mouseNDC.x = 0;
      mouseNDC.y = 0;
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

  const normalCurve = new THREE.CatmullRomCurve3(waypoints, true);
  let normalT = 0;
  const baseSpeed = 0.00015;

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
    defenseCurve = new THREE.CatmullRomCurve3(dPts, true);
  }

  // ── Shared smoothed state ───────────────────────────────
  const _posTarget = new THREE.Vector3();
  const _lookTarget = new THREE.Vector3();
  let smoothBank = 0;

  const halfGrid = (GRID / 2) * CELL;
  const _forward = new THREE.Vector3();

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
    } else if (currentMode === "defense" && defenseCurve) {
      // ── Defense mode: drone follows patrol path, camera orbits city center ──

      defenseT = (defenseT + defenseSpeed) % 1;
      const curvePoint = defenseCurve.getPointAt(defenseT);

      // Drone position lerps toward patrol path point
      _posTarget.copy(curvePoint);
      camera.position.lerp(_posTarget, 0.08);

      // Camera always looks down at the city center (origin)
      const lookDown = new THREE.Vector3(0, 5, 0);
      camera.lookAt(lookDown);

      // Subtle banking from path curvature
      const p1 = defenseCurve.getPointAt(defenseT);
      const p2 = defenseCurve.getPointAt((defenseT + 0.01) % 1);
      const p3 = defenseCurve.getPointAt((defenseT + 0.02) % 1);
      const v1 = new THREE.Vector3().subVectors(p2, p1).normalize();
      const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
      const cross = new THREE.Vector3().crossVectors(v1, v2);

      let rawBank = cross.y * 0.3;
      rawBank = Math.max(-0.2, Math.min(0.2, rawBank));
      smoothBank += (rawBank - smoothBank) * 0.08;
      camera.rotateZ(smoothBank);
    } else {
      // ── Normal curve flythrough ──
      normalT = (normalT + baseSpeed) % 1;

      const curvePoint = normalCurve.getPointAt(normalT);
      _posTarget.copy(curvePoint);
      camera.position.lerp(_posTarget, 0.1);

      // Look-ahead along curve
      const lookT = (normalT + 0.04) % 1;
      _lookTarget.lerp(normalCurve.getPointAt(lookT), 0.08);
      const midH = 20;
      if (camera.position.y > midH) {
        const excess = camera.position.y - midH;
        _lookTarget.y = camera.position.y - excess * 0.6;
      } else {
        _lookTarget.y = camera.position.y;
      }
      camera.lookAt(_lookTarget);

      // Banking from curve curvature
      const p1 = normalCurve.getPointAt(normalT);
      const p2 = normalCurve.getPointAt((normalT + 0.01) % 1);
      const p3 = normalCurve.getPointAt((normalT + 0.02) % 1);

      const v1 = new THREE.Vector3().subVectors(p2, p1).normalize();
      const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();
      const cross = new THREE.Vector3().crossVectors(v1, v2);

      let rawBank = cross.y * 0.5;
      rawBank = Math.max(-0.3, Math.min(0.3, rawBank));
      smoothBank += (rawBank - smoothBank) * 0.1;
      camera.rotateZ(smoothBank);
    }

    requestAnimationFrame(fly);
  }

  fly();
}
