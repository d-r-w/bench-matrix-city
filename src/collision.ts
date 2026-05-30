// AABB collision detection for lasers vs buildings (and drones)
import * as THREE from "three";
import { BUILDING_WIDTH } from "./constants.js";
import type { BuildingHeight } from "./types.js";

const _ray = new THREE.Ray();
const _hitPoint = new THREE.Vector3();
const _normal = new THREE.Vector3();

/**
 * Test a laser ray against all building AABBs.
 * Returns the closest hit or null if nothing is struck within range.
 */
export function testLaserVsBuildings(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDist: number,
  buildings: BuildingHeight[]
): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
  _ray.set(origin, direction);

  let closestT = Infinity;
  let hitPoint: THREE.Vector3 | null = null;
  let hitNormal: THREE.Vector3 | null = null;

  const hw = BUILDING_WIDTH / 2 + 0.15; // slight padding for visual overlap

  for (const b of buildings) {
    const boxMinX = b.x - hw;
    const boxMaxX = b.x + hw;
    const boxMinZ = b.z - hw;
    const boxMaxZ = b.z + hw;
    const boxMaxY = b.h * 0.32; // matches building-box height calc

    const t = rayVsAABB(_ray, boxMinX, boxMaxX, 0, boxMaxY, boxMinZ, boxMaxZ);

    if (t !== null && t > 0.1 && t < maxDist && t < closestT) {
      closestT = t;
      hitPoint = _hitPoint.copy(origin).addScaledVector(direction, t);
      // Compute approximate face normal from which side was hit
      const localX = hitPoint.x - b.x;
      const _localY = hitPoint.y - boxMaxY / 2;
      const localZ = hitPoint.z - b.z;

      if (Math.abs(localX) > Math.abs(localZ)) {
        _normal.set(Math.sign(localX), 0, 0);
      } else {
        _normal.set(0, 0, Math.sign(localZ));
      }
      // If hit near top, use up normal
      if (hitPoint.y >= boxMaxY - 0.3) {
        _normal.set(0, 1, 0);
      }

      hitNormal = _normal.clone();
    }
  }

  if (hitPoint && hitNormal) {
    return { point: hitPoint, normal: hitNormal };
  }
  return null;
}

/** Ray vs AABB — returns closest t or null. */
function rayVsAABB(
  ray: THREE.Ray,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number
): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;

  const ox = ray.origin.x;
  const oy = ray.origin.y;
  const oz = ray.origin.z;
  const dx = ray.direction.x;
  const dy = ray.direction.y;
  const dz = ray.direction.z;

  // X slab
  if (Math.abs(dx) > 1e-8) {
    let t1 = (minX - ox) / dx;
    let t2 = (maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin >= tmax) return null;
  } else if (ox < minX || ox > maxX) {
    return null;
  }

  // Y slab
  if (Math.abs(dy) > 1e-8) {
    let t1 = (minY - oy) / dy;
    let t2 = (maxY - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin >= tmax) return null;
  } else if (oy < minY || oy > maxY) {
    return null;
  }

  // Z slab
  if (Math.abs(dz) > 1e-8) {
    let t1 = (minZ - oz) / dz;
    let t2 = (maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin >= tmax) return null;
  } else if (oz < minZ || oz > maxZ) {
    return null;
  }

  if (tmax < 0) return null;
  return tmin > 0 ? tmin : tmax;
}

/** Test a laser ray against police drone bounding spheres. */
export function testLaserVsDrones(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDist: number,
  drones: THREE.Group[]
): { point: THREE.Vector3; droneIndex: number; drone: THREE.Group } | null {
  const DRONE_RADIUS = 0.8; // generous hitbox

  let closestT = Infinity;
  let hitPoint: THREE.Vector3 | null = null;
  let hitIdx = -1;

  for (let i = 0; i < drones.length; i++) {
    const drone = drones[i];
    const dx = drone.position.x - origin.x;
    const dy = drone.position.y - origin.y;
    const dz = drone.position.z - origin.z;

    // Project onto ray direction → closest point on ray to sphere center
    const t = dx * direction.x + dy * direction.y + dz * direction.z;
    if (t < 0 || t > maxDist) continue;

    // Distance from ray to sphere center at that t
    const rx = origin.x + t * direction.x - drone.position.x;
    const ry = origin.y + t * direction.y - drone.position.y;
    const rz = origin.z + t * direction.z - drone.position.z;
    const distSq = rx * rx + ry * ry + rz * rz;

    if (distSq < DRONE_RADIUS * DRONE_RADIUS && t < closestT) {
      closestT = t;
      hitPoint = _hitPoint.set(
        origin.x + t * direction.x,
        origin.y + t * direction.y,
        origin.z + t * direction.z
      );
      hitIdx = i;
    }
  }

  if (hitPoint && hitIdx >= 0) {
    return { point: hitPoint.clone(), droneIndex: hitIdx, drone: drones[hitIdx] };
  }
  return null;
}
