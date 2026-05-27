// City builder orchestrator (test.html L1332-L1426)
import * as THREE from "three";
import { CELL, GRID } from "../constants.js";
import type { BuildingHeight } from "../types.js";
import { buildPoliceDrones, type DroneSpawnPoint } from "../vehicles/drone-manager.js";
import { createVehicle } from "../vehicles/vehicle.js";
import { addAntenna } from "./geometry/antenna.js";

// Geometry details
import { createBuildingBox } from "./geometry/building-box.js";
import { addDoors } from "./geometry/doors.js";
import { addRoofDetails } from "./geometry/roof-details.js";
import { addSatelliteDish } from "./geometry/satellite-dish.js";
import { addWindowGrid } from "./geometry/window-grid.js";
// Helpers
import {
  addRoofChars,
  addWallChars,
  calcBuildingHeight,
  fillChance,
  isRoadCell,
} from "./helpers.js";

// Mesh building
import { buildInstancedMesh } from "./instanced-mesh.js";
import { mergeBufferGeometries } from "./merge-geometries.js";

/** Build the entire city scene. Returns building heights array. */
export function buildCity(scene: THREE.Scene): BuildingHeight[] {
  const half = Math.floor(GRID / 2);

  const positions: number[] = [];
  const charIndices: number[] = [];
  const brightFlags: number[] = [];

  // Collect detail groups for merging
  const buildingMeshes: (THREE.Mesh | THREE.Group)[] = [];
  const windowMeshes: THREE.InstancedMesh[] = [];
  const antennaGroups: THREE.Group[] = [];
  const buildingHeights: BuildingHeight[] = [];

  // ── Place buildings on the grid ───────────────────────────
  for (let gx = -half; gx <= half; gx++) {
    for (let gz = -half; gz <= half; gz++) {
      // Skip road cells — buildings only on odd grid positions
      if (isRoadCell(gx, gz)) continue;

      const dist = Math.sqrt(gx * gx + gz * gz);
      const maxH = calcBuildingHeight(gx, gz);

      // Randomly leave blocks empty for plazas — denser near center
      if (Math.random() > fillChance(dist)) continue;

      const bx = gx * CELL;
      const bz = gz * CELL;
      buildingHeights.push({ x: bx, z: bz, h: maxH });

      // ── Building geometry details ─────────────────────
      buildingMeshes.push(createBuildingBox(bx, bz, maxH));

      const windows = addWindowGrid(bx, bz, maxH);
      if (windows) windowMeshes.push(windows);

      // Doors on ~40% of buildings
      if (Math.random() > 0.6) {
        scene.add(addDoors(bx, bz));
      }

      // Antennas on ~35% of buildings, more likely on taller ones
      if (Math.random() > 0.5 - maxH * 0.01) {
        antennaGroups.push(addAntenna(bx, bz, maxH));
      }

      // Satellite dishes on ~15% of buildings, more likely near center
      if (Math.random() > 0.7 + dist * 0.02) {
        scene.add(addSatelliteDish(bx, bz, maxH));
      }

      // Roof details (AC units, water towers)
      const roofResult = addRoofDetails(bx, bz, maxH);
      buildingHeights[buildingHeights.length - 1].hasWaterTower = roofResult.hasWaterTower;
      scene.add(roofResult.group);

      addWallChars(positions, charIndices, brightFlags, bx, bz, maxH, dist);
      addRoofChars(positions, charIndices, brightFlags, bx, bz, maxH, dist);
    }
  }

  // ── Merge building boxes into single mesh for performance ─
  if (buildingMeshes.length > 0) {
    const mergedGeo = mergeBufferGeometries(buildingMeshes);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x050a06,
      roughness: 0.85,
      metalness: 0.3,
    });
    const buildingGroup = new THREE.Mesh(mergedGeo, buildingMat);
    scene.add(buildingGroup);
  }

  // ── Build the instanced character mesh ────────────────────
  const mesh = buildInstancedMesh(positions, charIndices, brightFlags);
  scene.add(mesh);
  window._matrixInstancedMesh = mesh;

  // ── Add window meshes to scene ────────────────────────────
  for (const wm of windowMeshes) {
    scene.add(wm);
  }

  // ── Add antenna groups to scene ───────────────────────────
  for (const ag of antennaGroups) {
    scene.add(ag);
  }

  // ── Store references for animation ────────────────────────
  window._windowMeshes = windowMeshes;
  window._antennaGroups = antennaGroups;

  // ── Add flying vehicles with light trails ─────────────────
  const vehicles: THREE.Object3D[] = [];
  for (let i = 0; i < 20; i++) {
    const v = createVehicle();
    scene.add(v);
    vehicles.push(v);
  }
  window._vehicles = vehicles;

  // ── Police drones take off from building rooftops (no water towers) ─
  const droneSpawnPoints: DroneSpawnPoint[] = buildingHeights
    .filter((b) => !b.hasWaterTower && b.h > 8)
    .map((b) => ({ x: b.x, y: b.h * 0.32 + 1.5, z: b.z }));
  buildPoliceDrones(scene, droneSpawnPoints);

  return buildingHeights;
}
