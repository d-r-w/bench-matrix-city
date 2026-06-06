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
export function applyDeadSpotsToGlyphs(mesh: THREE.InstancedMesh): void {
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

/**
 * Apply dead spots to window grid instanced meshes.
 * Windows use standard instance matrices (with rotation), so we decompose each matrix
 * to get the world-space position for distance checks.
 */
const _decomposedPos = new THREE.Vector3();

export function applyDeadSpotsToWindows(meshes: THREE.InstancedMesh[]): void {
  if (activeDeadSpots.length === 0 || meshes.length === 0) return;

  const tempMatrix = new THREE.Matrix4();

  for (const mesh of meshes) {
    for (const spot of activeDeadSpots) {
      const cx = spot.center.x;
      const cy = spot.center.y;
      const cz = spot.center.z;

      let needsUpdate = false;

      for (let j = 0; j < mesh.count; j++) {
        mesh.getMatrixAt(j, tempMatrix);
        _decomposedPos.setFromMatrixPosition(tempMatrix);

        const dx = _decomposedPos.x - cx;
        const dy = _decomposedPos.y - cy;
        const dz = _decomposedPos.z - cz;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < spot.radiusSq) {
          // Scale the window to zero — effectively kills it
          const dummy = new THREE.Object3D();
          dummy.position.copy(_decomposedPos);
          dummy.rotation.setFromQuaternion(
            new THREE.Quaternion().setFromRotationMatrix(tempMatrix)
          );
          dummy.scale.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(j, dummy.matrix);
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

/** Remove all dead spots (cleanup). */
export function clearDeadSpots(): void {
  activeDeadSpots.length = 0;
}
