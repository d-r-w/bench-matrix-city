// Flying vehicles with light trails (test.html L590-L649, update L2192-L2214)
import * as THREE from "three";

import { CELL, GRID } from "../constants.js";
import type { VehicleUserData } from "../types.js";

/** Create a single flying vehicle with trail. */
export function createVehicle(): THREE.Object3D {
  const r = Math.random();
  const vColor = r > 0.7 ? 0x44ffdd : r > 0.5 ? 0xffaa33 : 0x55ff77;

  const vMat = new THREE.MeshBasicMaterial({
    color: vColor,
    transparent: true,
    opacity: 0.6,
  });
  const vGeo = new THREE.SphereGeometry(0.12, 4, 3);
  const vehicle = new THREE.Mesh(vGeo, vMat);

  // Pick a random avenue to fly along
  const axis = Math.random() > 0.5 ? ("x" as const) : ("z" as const);
  const roadIdx = Math.floor((Math.random() * 2 - 1) * (GRID / 2));
  const roadPos = roadIdx * 2 * CELL;

  vehicle.position.set(
    axis === "x" ? (Math.random() - 0.5) * GRID * CELL : roadPos,
    8 + Math.random() * 30,
    axis === "z" ? (Math.random() - 0.5) * GRID * CELL : roadPos
  );

  const ud = vehicle.userData as VehicleUserData;
  ud.flyAxis = axis;
  ud.flySpeed = 3 + Math.random() * 5;
  ud.flyDir = Math.random() > 0.5 ? 1 : -1;
  ud.flyY = vehicle.position.y;

  // Trail behind the vehicle (opposite to direction of travel)
  const dir = -ud.flyDir;
  const trailGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(axis === "x" ? dir * 2 : 0, 0, axis === "z" ? dir * 2 : 0),
  ]);
  const trailMat = new THREE.LineBasicMaterial({
    color: vColor,
    transparent: true,
    opacity: 0.2,
  });
  vehicle.add(new THREE.Line(trailGeo, trailMat));

  return vehicle;
}

/** Update all vehicles (test.html L2192-L2214). */
export function updateVehicles(dt: number, elapsed: number): void {
  const vehicles = window._vehicles;
  if (!vehicles) return;

  const citySize = GRID * CELL;
  for (const v of vehicles) {
    const ud = v.userData as VehicleUserData;
    if (ud.flySpeed === undefined) continue;

    const move = ud.flySpeed * ud.flyDir * dt;
    if (ud.flyAxis === "x") {
      v.position.x += move;
      if (Math.abs(v.position.x) > citySize) {
        v.position.x = -Math.sign(v.position.x) * (citySize - 1);
        ud.flyY = 8 + Math.random() * 30;
      }
    } else {
      v.position.z += move;
      if (Math.abs(v.position.z) > citySize) {
        v.position.z = -Math.sign(v.position.z) * (citySize - 1);
        ud.flyY = 8 + Math.random() * 30;
      }
    }

    // Smooth altitude changes
    v.position.y += (ud.flyY - v.position.y) * dt * 0.5;
    // Subtle bob
    v.position.y += Math.sin(elapsed * 2 + v.id) * 0.01;
  }
}
