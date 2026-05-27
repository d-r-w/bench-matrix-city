// Police drone patrol routes + manager (test.html L1428-L1517, update L2216-L2280)
import * as THREE from "three";

import { CELL } from "../constants.js";
import type { DroneUserData } from "../types.js";
import { createPoliceDrone } from "./police-drone.js";

const DRONE_RESPAWN_TIME = 30; // seconds before a destroyed drone comes back

interface DestroyedDroneRecord {
  curve: THREE.CatmullRomCurve3;
  speed: number;
  dir: number;
  blinkPhase: number;
  destroyedAt: number; // elapsed time when destroyed
}

interface SegmentDef {
  fixedAxis: "x" | "z";
  fixedIdx: number;
  varyStart: number;
  varyEnd: number;
  step: number;
}

/** Build a CatmullRomCurve3 patrol path from segment definitions. */
function makePatrolPath(segments: SegmentDef[]): THREE.CatmullRomCurve3 | null {
  const roadCenter = (idx: number) => idx * CELL;
  const pts: THREE.Vector3[] = [];
  let segIdx = 0;

  for (const { fixedAxis, fixedIdx, varyStart, varyEnd, step } of segments) {
    for (let v = varyStart; step > 0 ? v <= varyEnd : v >= varyEnd; v += step) {
      const h = 12 + ((Math.sin(segIdx * 0.4) + 1) / 2) * 25;
      segIdx++;
      const pt =
        fixedAxis === "x"
          ? new THREE.Vector3(roadCenter(fixedIdx), h, roadCenter(v))
          : new THREE.Vector3(roadCenter(v), h, roadCenter(fixedIdx));

      // Skip duplicate consecutive points (segment boundaries)
      if (pts.length > 0 && pts[pts.length - 1].distanceTo(pt) < 0.01) continue;
      pts.push(pt);
    }
  }

  if (pts.length < 4) return null;
  return new THREE.CatmullRomCurve3(pts, true);
}

/** Build police drones on patrol curves and register them globally. */
export function buildPoliceDrones(scene: THREE.Scene): void {
  // Define 3 patrol routes — parallel to camera but on different roads
  const patrolRoutes = [
    // Route 1: outer ring (x=2, z=6, x=-2, z=-4)
    makePatrolPath([
      { fixedAxis: "x", fixedIdx: 2, varyStart: -6, varyEnd: 4, step: 2 },
      { fixedAxis: "z", fixedIdx: 4, varyStart: 2, varyEnd: 6, step: 2 },
      { fixedAxis: "x", fixedIdx: 6, varyStart: 4, varyEnd: -6, step: -2 },
      { fixedAxis: "z", fixedIdx: -6, varyStart: 6, varyEnd: -2, step: -2 },
      { fixedAxis: "x", fixedIdx: -2, varyStart: -6, varyEnd: 0, step: 2 },
      { fixedAxis: "z", fixedIdx: 0, varyStart: -2, varyEnd: 2, step: 2 },
      { fixedAxis: "x", fixedIdx: 2, varyStart: 0, varyEnd: -6, step: -2 },
    ]),
    // Route 2: inner ring (x=-6, z=2, x=4, z=-2)
    makePatrolPath([
      { fixedAxis: "x", fixedIdx: -6, varyStart: -4, varyEnd: 2, step: 2 },
      { fixedAxis: "z", fixedIdx: 2, varyStart: -6, varyEnd: 4, step: 2 },
      { fixedAxis: "x", fixedIdx: 4, varyStart: 2, varyEnd: -4, step: -2 },
      { fixedAxis: "z", fixedIdx: -4, varyStart: 4, varyEnd: -6, step: -2 },
      { fixedAxis: "x", fixedIdx: -4, varyStart: -4, varyEnd: 0, step: 2 },
      { fixedAxis: "z", fixedIdx: 0, varyStart: -4, varyEnd: -6, step: -2 },
      { fixedAxis: "x", fixedIdx: -6, varyStart: 0, varyEnd: -4, step: -2 },
    ]),
    // Route 3: center sweep (x=0, z=-2, x=-8, z=6)
    makePatrolPath([
      { fixedAxis: "x", fixedIdx: 0, varyStart: -2, varyEnd: 6, step: 2 },
      { fixedAxis: "z", fixedIdx: 6, varyStart: 0, varyEnd: -8, step: -2 },
      { fixedAxis: "x", fixedIdx: -8, varyStart: 6, varyEnd: -2, step: -2 },
      { fixedAxis: "z", fixedIdx: -2, varyStart: -8, varyEnd: 0, step: 2 },
    ]),
  ];

  const NUM_DRONES = 6;
  const drones: THREE.Group[] = [];
  const validRoutes = patrolRoutes.filter((c): c is THREE.CatmullRomCurve3 => c !== null);

  for (let i = 0; i < NUM_DRONES; i++) {
    const drone = createPoliceDrone();
    if (validRoutes.length === 0) {
      scene.remove(drone);
      continue;
    }
    const curve = validRoutes[i % validRoutes.length];

    // Each drone starts at a different position along its route
    const startT = i / NUM_DRONES + (i % validRoutes.length) * 0.15;
    const speed = 0.00008 + Math.random() * 0.00006;

    // Alternate direction for variety
    const dir = i % 2 === 0 ? 1 : -1;

    const ud = drone.userData as DroneUserData;
    ud.curve = curve;
    ud.t = startT % 1;
    ud.speed = speed;
    ud.dir = dir;
    ud.blinkPhase = Math.random() * Math.PI * 2;

    // Set initial position
    const pt = curve.getPointAt(ud.t);
    drone.position.copy(pt);

    scene.add(drone);
    drones.push(drone);
  }

  window._policeDrones = drones;
}

// ── Drone destruction & respawn ───────────────────────────────────
const destroyedDrones: DestroyedDroneRecord[] = [];

/** Remove a drone from the scene and queue it for respawn. */
export function destroyDrone(drone: THREE.Group, elapsed: number): void {
  const ud = drone.userData as DroneUserData;
  if (!ud.curve) return; // nothing to respawn into

  destroyedDrones.push({
    curve: ud.curve,
    speed: ud.speed ?? 0.0001,
    dir: ud.dir ?? 1,
    blinkPhase: ud.blinkPhase ?? 0,
    destroyedAt: elapsed,
  });

  // Remove from scene
  if (drone.parent) drone.parent.remove(drone);

  // Remove from the live tracking array
  const drones = window._policeDrones;
  if (drones) {
    const idx = drones.indexOf(drone);
    if (idx !== -1) drones.splice(idx, 1);
  }
}

/** Check for expired destroyed drones and respawn them. */
export function checkAndRespawnDrones(scene: THREE.Scene, elapsed: number): void {
  const drones = window._policeDrones ?? [];

  for (let i = destroyedDrones.length - 1; i >= 0; i--) {
    const record = destroyedDrones[i];
    if (elapsed - record.destroyedAt < DRONE_RESPAWN_TIME) continue;

    // Respawn!
    const drone = createPoliceDrone();
    const ud = drone.userData as DroneUserData;
    ud.curve = record.curve;
    ud.t = 0;
    ud.speed = record.speed;
    ud.dir = record.dir;
    ud.blinkPhase = record.blinkPhase;

    const pt = record.curve.getPointAt(ud.t);
    drone.position.copy(pt);

    scene.add(drone);
    drones.push(drone);

    destroyedDrones.splice(i, 1);
  }
}

/** Update all police drones along patrol curves (test.html L2216-L2280). */
export function updateDrones(cameraPos: THREE.Vector3, _dt: number, elapsed: number): void {
  const drones = window._policeDrones;
  if (!drones) return;

  for (const drone of drones) {
    const ud = drone.userData as DroneUserData;
    const curve = ud.curve;
    if (!curve) continue;

    ud.t = (ud.t + ud.speed * ud.dir) % 1;
    if (ud.t < 0) ud.t += 1;

    const pt = curve.getPointAt(ud.t);
    drone.position.lerp(pt, 0.15);

    // Look ahead along curve
    let lookT = (ud.t + 0.02 * ud.dir) % 1;
    if (lookT < 0) lookT += 1;
    const lookPt = curve.getPointAt(lookT);
    drone.lookAt(lookPt);

    // Update rotating/pulsing halo
    if (ud.haloMat) {
      ud.haloMat.uniforms.uTime.value = elapsed;
    }

    // Update searchlight beam + ground disc time uniforms
    if (ud.beamMat) {
      ud.beamMat.uniforms.uTime.value = elapsed;
    }
    if (ud.discMat) {
      ud.discMat.uniforms.uTime.value = elapsed;
    }

    // ── Proximity detection: turn beam red when POV camera is within the beam ──
    const hDist = Math.sqrt(
      (cameraPos.x - drone.position.x) ** 2 + (cameraPos.z - drone.position.z) ** 2
    );
    // How far down the beam the camera sits (0 = drone level, 1 = beam bottom)
    const depthFrac = Math.max(0, Math.min(1, (drone.position.y - cameraPos.y) / 10));
    // Beam radius at camera depth (tapers from 0.02 at top to 1.8 at bottom)
    const radiusAtDepth = 0.02 + (1.8 - 0.02) * depthFrac;
    // Normalized proximity: 1 = camera inside beam, 0 = far outside
    let prox = Math.max(0, 1 - hDist / (radiusAtDepth * 2.5));
    prox = prox ** 0.6; // Soften the falloff
    prox = Math.min(1, prox);

    if (ud.beamMat) {
      ud.beamMat.uniforms.uProximity.value = prox;
    }
    if (ud.discMat) {
      ud.discMat.uniforms.uProximity.value = prox;
    }
    // Also tint the spot light red when camera is in beam
    if (ud.spotLight) {
      const r = Math.round(0x00 + prox * 0xff);
      const g = Math.round(0xff - prox * 0xf8);
      const b = Math.round(0x44 + prox * 0x1c);
      ud.spotLight.color.setRGB(r / 255, g / 255, b / 255);
    }

    // Subtle hover bob
    drone.position.y += Math.sin(elapsed * 3 + ud.blinkPhase) * 0.02;
  }
}
