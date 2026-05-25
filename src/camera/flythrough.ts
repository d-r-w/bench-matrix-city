// Camera drone flythrough + manual steering (test.html L1955-L2096, steer button L328-L340)
import * as THREE from "three";

import { CELL, GRID } from "../constants.js";

// ── Steering state (encapsulated, replaces globals) ────────────────

let manualSteering = false;
const mouseNDC = { x: 0, y: 0 };
const freePos = new THREE.Vector3();
let freeYaw = 0;
let freePitch = 0;
const freeSpeed = 1; // world units / sec

export function isManualSteering(): boolean {
  return manualSteering;
}

// ── Steer button DOM wiring (test.html L328-L340) ────────────────

let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;

export function createSteerButton(camera: THREE.PerspectiveCamera): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = "steer-toggle";
  btn.textContent = "[ STEER ]";
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    manualSteering = !manualSteering;
    btn.classList.toggle("active", manualSteering);
    btn.textContent = manualSteering ? "[ FREE ]" : "[ STEER ]";

    if (manualSteering) {
      // Capture current camera position into freePos
      freePos.copy(camera.position);

      // Derive initial yaw/pitch from camera's world direction
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      freeYaw = Math.atan2(-dir.x, -dir.z);
      freePitch = Math.asin(dir.y);

      // Wire up mousemove listener for NDC tracking
      if (!mouseMoveHandler) {
        mouseMoveHandler = (e: MouseEvent) => {
          mouseNDC.x = (e.clientX / innerWidth) * 2 - 1;
          mouseNDC.y = -(e.clientY / innerHeight) * 2 + 1;
        };
        document.addEventListener("mousemove", mouseMoveHandler);
      }
    } else {
      // Reset NDC when returning to curve flythrough
      mouseNDC.x = 0;
      mouseNDC.y = 0;
    }
  });

  return btn;
}

// ── Drone flythrough (test.html L1955-L2096) ──────────────────────

/** Start the camera drone flythrough loop. */
export function startDroneFlythrough(camera: THREE.PerspectiveCamera): void {
  const waypoints: THREE.Vector3[] = [];

  // Road centers are at even grid positions * CELL.
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

  // ── Path: outer rectangle with inner detour through center ──

  // 1. North along x=0 road (z: -6 → 4)
  addSegment("x", 0, -6, 4, 2);
  // 2. East along z=4 road (x: 0 → 6)
  addSegment("z", 4, 0, 6, 2);
  // 3. South along x=6 road (z: 4 → -6)
  addSegment("x", 6, 4, -6, -2);
  // 4. West along z=-6 road (x: 6 → -4)
  addSegment("z", -6, 6, -4, -2);
  // 5. North along x=-4 road (z: -6 → 0) — inner loop
  addSegment("x", -4, -6, 0, 2);
  // 6. East along z=0 road (x: -4 → 0) — through city center
  addSegment("z", 0, -4, 0, 2);
  // 7. South along x=0 road (z: 0 → -6) — back to start
  addSegment("x", 0, 0, -6, -2);

  const curve = new THREE.CatmullRomCurve3(waypoints, true);
  let t = 0;
  const baseSpeed = 0.00015;

  // Smoothed state — everything trails its ideal value for fluid motion
  const _posTarget = new THREE.Vector3();
  const _lookTarget = new THREE.Vector3();
  let smoothBank = 0;

  // Grid bounds for bounce detection
  const halfGrid = (GRID / 2) * CELL;

  // Reusable vectors to avoid GC pressure in the fly loop
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();

  let lastFlyTime = performance.now();

  function fly(): void {
    const now = performance.now();
    const dtSec = Math.min((now - lastFlyTime) / 1000, 0.1); // cap at 100ms
    lastFlyTime = now;

    t = (t + baseSpeed) % 1;

    if (manualSteering) {
      // ── Free flight: move forward in facing direction ──

      const steerRate = 1.8; // radians/sec sensitivity
      freeYaw += -mouseNDC.x * steerRate * dtSec;
      freePitch += mouseNDC.y * steerRate * 0.6 * dtSec;
      // Clamp pitch to avoid flipping
      freePitch = Math.max(-1.2, Math.min(1.2, freePitch));

      // Compute forward direction from yaw + pitch
      _forward.set(
        -Math.sin(freeYaw) * Math.cos(freePitch),
        Math.sin(freePitch),
        -Math.cos(freeYaw) * Math.cos(freePitch)
      );

      // Move forward
      freePos.addScaledVector(_forward, freeSpeed * dtSec);

      // ── World bound bounce (invert direction on axis) ──
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

      // Apply position & orientation
      camera.position.copy(freePos);

      // Look target = current pos + forward direction (with slight distance)
      _lookTarget.copy(freePos).addScaledVector(_forward, 10);
      camera.lookAt(_lookTarget);

      // Banking from yaw rate (turn feel)
      const yawDelta = -mouseNDC.x * steerRate;
      smoothBank += (yawDelta * 0.15 - smoothBank) * 0.1;
      camera.rotateZ(smoothBank);
    } else {
      // ── Normal curve flythrough ──
      const curvePoint = curve.getPointAt(t);
      _posTarget.copy(curvePoint);
      camera.position.lerp(_posTarget, 0.1);

      // Look-ahead along curve
      const lookT = (t + 0.04) % 1;
      _lookTarget.lerp(curve.getPointAt(lookT), 0.08);
      // Tilt down only when flying above mid-range (height > 20)
      const midH = 20;
      if (camera.position.y > midH) {
        const excess = camera.position.y - midH;
        _lookTarget.y = camera.position.y - excess * 0.6;
      } else {
        _lookTarget.y = camera.position.y;
      }
      camera.lookAt(_lookTarget);

      // Banking from curve curvature
      const p1 = curve.getPointAt(t);
      const p2 = curve.getPointAt((t + 0.01) % 1);
      const p3 = curve.getPointAt((t + 0.02) % 1);
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
