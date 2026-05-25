// Merge multiple BufferGeometry objects into one (test.html L872-L923)
import * as THREE from "three";

/**
 * Merge an array of Mesh or Group objects into a single BufferGeometry.
 * Handles both plain meshes and groups with child offset transforms.
 */
export function mergeBufferGeometries(meshes: (THREE.Mesh | THREE.Group)[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  function processMesh(geo: THREE.BufferGeometry, px: number, py: number, pz: number): void {
    geo.translate(px, py, pz);

    const posAttr = geo.getAttribute("position");
    const normAttr = geo.getAttribute("normal");
    const uvAttr = geo.getAttribute("uv");

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      if (uvAttr) uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }

    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) {
        indices.push(geo.index.array[i] + indexOffset);
      }
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        indices.push(i + indexOffset);
      }
    }

    indexOffset += posAttr.count;
  }

  for (const obj of meshes) {
    if (obj instanceof THREE.Group) {
      // Group: process each child with parent offset
      for (const child of obj.children) {
        const geo = (child as THREE.Mesh).geometry.clone();
        processMesh(
          geo,
          obj.position.x + (child as THREE.Object3D).position.x,
          obj.position.y + (child as THREE.Object3D).position.y,
          obj.position.z + (child as THREE.Object3D).position.z
        );
      }
    } else {
      // Plain mesh
      const geo = (obj as THREE.Mesh).geometry.clone();
      processMesh(geo, obj.position.x, obj.position.y, obj.position.z);
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);

  return merged;
}
