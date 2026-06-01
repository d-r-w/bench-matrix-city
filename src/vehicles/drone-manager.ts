// Police drone patrol routes + manager — drones take off from building rooftops
import * as THREE from "three";

import { CELL } from "../constants.js";
import type { DroneUserData } from "../types.js";
import { recordDyingDrone } from "../ui/radar.js";
import { createPoliceDrone } from "./police-drone.js";

const DRONE_RESPAWN_TIME = 30; // seconds before a destroyed drone comes back
const TAKEOFF_HOVER_DURATION = 10.8; // seconds hovering on rooftop before rising
const TAKEOFF_RISE_DURATION = 10.5; // seconds for the slow ascent to patrol altitude

export interface DroneSpawnPoint {
  x: number;
  y: number; // roof height + offset (ready-to-fly position)
  z: number;
}

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
      // Patrol altitude scaled to match rendered building heights (raw h * 0.32)
      const h = 8 + ((Math.sin(segIdx * 0.4) + 1) / 2) * 10;
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

/** Pick a random spawn point from the pool. */
function pickSpawnPoint(spawnPoints: DroneSpawnPoint[]): DroneSpawnPoint {
  return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
}

// ── Persistent state for respawn ────────────────────────────────
const destroyedDrones: DestroyedDroneRecord[] = [];
let _spawnPoints: DroneSpawnPoint[] = [];

/** Build police drones on patrol curves, launching from building rooftops. */
export function buildPoliceDrones(scene: THREE.Scene, spawnPoints: DroneSpawnPoint[]): void {
  if (spawnPoints.length === 0) return;
  _spawnPoints = spawnPoints;

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
    if (validRoutes.length === 0) continue;

    const drone = createPoliceDrone();
    const curve = validRoutes[i % validRoutes.length];
    const speed = 0.00008 + Math.random() * 0.00006;
    const dir = i % 2 === 0 ? 1 : -1;

    // Pick a random building rooftop as takeoff point
    const spawn = pickSpawnPoint(spawnPoints);

    const ud = drone.userData as DroneUserData;
    ud.curve = curve;
    ud.t = (i / NUM_DRONES + i * 0.15) % 1;
    ud.speed = speed;
    ud.dir = dir;
    ud.blinkPhase = Math.random() * Math.PI * 2;

    // Takeoff state — drone starts on the rooftop, hovers menacingly, then rises slowly
    ud.isTakingOff = true;
    ud.takeoffPhase = "hover";
    ud.takeoffStartY = spawn.y;
    ud.takeoffX = spawn.x;
    ud.takeoffZ = spawn.z;

    const curvePt = curve.getPointAt(ud.t);
    ud.takeoffTargetY = curvePt.y; // rise to the patrol altitude at this route position

    // Position drone on the rooftop
    drone.position.set(spawn.x, spawn.y, spawn.z);

    scene.add(drone);
    drones.push(drone);
  }

  window._policeDrones = drones;
}

// ── Drone destruction & respawn ───────────────────────────────────
/** Remove a drone from the scene and queue it for rooftop respawn. */
export function destroyDrone(drone: THREE.Group, elapsed: number): void {
  const ud = drone.userData as DroneUserData;
  if (!ud.curve) return;

  destroyedDrones.push({
    curve: ud.curve,
    speed: ud.speed ?? 0.0001,
    dir: ud.dir ?? 1,
    blinkPhase: ud.blinkPhase ?? 0,
    destroyedAt: elapsed,
  });

  // Record position for radar dying-display (~1s red X)
  recordDyingDrone(drone.position.x, drone.position.z, elapsed);

  // Remove from scene
  if (drone.parent) drone.parent.remove(drone);

  // Remove from the live tracking array
  const drones = window._policeDrones;
  if (drones) {
    const idx = drones.indexOf(drone);
    if (idx !== -1) drones.splice(idx, 1);
  }
}

/** Check for expired destroyed drones and respawn them from building rooftops. */
export function checkAndRespawnDrones(scene: THREE.Scene, elapsed: number): void {
  const drones = window._policeDrones ?? [];

  if (_spawnPoints.length === 0) return;

  for (let i = destroyedDrones.length - 1; i >= 0; i--) {
    const record = destroyedDrones[i];
    if (elapsed - record.destroyedAt < DRONE_RESPAWN_TIME) continue;

    // Pick a random building rooftop for the new drone to launch from
    const spawn = pickSpawnPoint(_spawnPoints);

    const drone = createPoliceDrone();
    const ud = drone.userData as DroneUserData;
    ud.curve = record.curve;
    ud.t = 0;
    ud.speed = record.speed;
    ud.dir = record.dir;
    ud.blinkPhase = record.blinkPhase;

    // Takeoff from rooftop — hover first, then slow rise
    ud.isTakingOff = true;
    ud.takeoffPhase = "hover";
    ud.takeoffStartY = spawn.y;
    ud.takeoffX = spawn.x;
    ud.takeoffZ = spawn.z;

    const curvePt = record.curve.getPointAt(ud.t);
    ud.takeoffTargetY = curvePt.y;

    drone.position.set(spawn.x, spawn.y, spawn.z);

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

    // ── Takeoff phase: hover on rooftop, then slow menacing rise ──
    if (ud.isTakingOff) {
      if (!ud.takeoffElapsed) {
        ud.takeoffElapsed = elapsed;
      }

      const startY = ud.takeoffStartY ?? drone.position.y;
      const targetY = ud.takeoffTargetY ?? 20;
      const startX = ud.takeoffX ?? drone.position.x;
      const startZ = ud.takeoffZ ?? drone.position.z;

      // Phase 1: Hover on rooftop — gentle bob only
      if (ud.takeoffPhase === "hover") {
        const hoverProgress = Math.min(1, (elapsed - ud.takeoffElapsed) / TAKEOFF_HOVER_DURATION);

        // Gentle bob while hovering
        drone.position.y = startY + Math.sin(hoverProgress * Math.PI * 2) * 0.15;
        drone.position.x = startX;
        drone.position.z = startZ;

        if (hoverProgress >= 1) {
          ud.takeoffPhase = "rise";
          ud.takeoffElapsed = elapsed; // reset timer for rise phase
        }
      }

      // Phase 2: Slow, deliberate ascent to patrol altitude
      else if (ud.takeoffPhase === "rise") {
        const progress = Math.min(1, (elapsed - ud.takeoffElapsed) / TAKEOFF_RISE_DURATION);

        // Ease-in-then-out: starts slow, accelerates mid-rise, settles at top
        // Creates that "gathering momentum" feel
        const eased =
          progress < 0.5
            ? 2 * progress * progress // ease-in for first half
            : 1 - (-2 * progress + 2) ** 2 / 2; // ease-out for second half

        drone.position.y = startY + (targetY - startY) * eased;

        // Slowly drift toward the curve's x/z position as we rise
        const pt = curve.getPointAt(ud.t);
        const driftFactor = eased * 0.6; // only move partway to curve during takeoff
        drone.position.x = startX + (pt.x - startX) * driftFactor;
        drone.position.z = startZ + (pt.z - startZ) * driftFactor;

        // Advance t slowly during rise so the curve position moves
        ud.t = (ud.t + ud.speed * ud.dir) % 1;
        if (ud.t < 0) ud.t += 1;

        // Complete takeoff when rise finishes
        if (progress >= 1) {
          ud.isTakingOff = false;
          ud.takeoffPhase = undefined;
          const finalPt = curve.getPointAt(ud.t);
          drone.position.x = finalPt.x;
          drone.position.z = finalPt.z;
          drone.rotation.x = 0; // reset tilt

          // Activate searchlight now that the drone is airborne
          if (ud.beamMat) {
            const beamMesh = drone.children.find(
              (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.material === ud.beamMat
            );
            if (beamMesh) beamMesh.visible = true;
          }
          if (ud.discMat) {
            const discMesh = drone.children.find(
              (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.material === ud.discMat
            );
            if (discMesh) discMesh.visible = true;
          }
          if (ud.spotLight) {
            ud.spotLight.visible = true;
          }
        }
      }

      // Update shader uniforms even during takeoff
      if (ud.haloMat) ud.haloMat.uniforms.uTime.value = elapsed;
      if (ud.beamMat) ud.beamMat.uniforms.uTime.value = elapsed;
      if (ud.discMat) ud.discMat.uniforms.uTime.value = elapsed;

      continue; // skip normal patrol update
    }

    // ── Normal patrol mode ────────────────────────────────
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
