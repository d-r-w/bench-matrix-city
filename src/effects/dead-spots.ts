// Dead spots — kill matrix characters around laser impact zones (GLSL + JS)
import * as THREE from "three";

const DEAD_SPOT_RADIUS = 2.5; // world units radius to suppress chars

interface DeadSpot {
  center: THREE.Vector3;
  radiusSq: number;
}

const activeDeadSpots: DeadSpot[] = [];

/**
 * Register a dead spot at the given world position.
 * Characters within `radius` will stop refreshing and fade out.
 */
export function registerDeadSpot(point: THREE.Vector3): void {
  activeDeadSpots.push({
    center: point.clone(),
    radiusSq: DEAD_SPOT_RADIUS * DEAD_SPOT_RADIUS,
  });
}

/**
 * Apply dead spots to the matrix character instanced mesh.
 * Characters inside any dead zone are permanently killed — zero alpha, never refresh again.
 */
export function applyDeadSpots(mesh: THREE.InstancedMesh): void {
  if (activeDeadSpots.length === 0) return;

  const ud = mesh.userData as Record<string, unknown>;
  const alphas = ud.alphas as Float32Array | undefined;
  const nextRefresh = ud.nextRefresh as Float32Array | undefined;

  if (!alphas || !nextRefresh) return;

  // Get instance positions from the custom attribute
  const posAttr = mesh.geometry.getAttribute("instancePosition") as THREE.BufferAttribute;
  if (!posAttr) return;

  for (const spot of activeDeadSpots) {
    const cx = spot.center.x;
    const cy = spot.center.y;
    const cz = spot.center.z;

    for (let j = 0; j < mesh.count; j++) {
      const px = posAttr.getX(j);
      const py = posAttr.getY(j);
      const pz = posAttr.getZ(j);

      const dx = px - cx;
      const dy = py - cy;
      const dz = pz - cz;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < spot.radiusSq) {
        // Permanently kill the character — zero alpha, never refresh again
        alphas[j] = 0.0;
        nextRefresh[j] = Infinity;
      }
    }
  }

  // Mark alpha attribute for GPU upload
  mesh.geometry.attributes.instanceAlpha.needsUpdate = true;
}

/** Remove all dead spots (cleanup). */
export function clearDeadSpots(): void {
  activeDeadSpots.length = 0;
}
