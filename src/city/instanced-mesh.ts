// Instanced character mesh for building-face glyphs (test.html L472-L608)
import * as THREE from "three";
import { ATLAS_COLS, ATLAS_ROWS, CHARS } from "../constants.js";
import { fragmentShader, vertexShader } from "../shaders/matrix-char.js";
import { buildTextureAtlas } from "../textures/atlas.js";

/** Compute UV offsets for the character atlas from a flat index array. */
export function computeUVOffsets(charIndices: number[], totalChars: number): Float32Array {
  const uvOffsets = new Float32Array(totalChars * 2);
  for (let i = 0; i < totalChars; i++) {
    const charIdx = charIndices[i];
    uvOffsets[i * 2] = (charIdx % ATLAS_COLS) / ATLAS_COLS;
    uvOffsets[i * 2 + 1] = Math.floor(charIdx / ATLAS_COLS) / ATLAS_ROWS;
  }
  return uvOffsets;
}

/** Create the Matrix glyph shader material. */
export function createMatrixShaderMaterial(atlasTex: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlasTex },
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}

/** Runtime animation data stored on the instanced mesh userData. */
export interface MatrixMeshData {
  uvOffsets: Float32Array;
  scales: Float32Array;
  alphas: Float32Array;
  charIndices: Uint16Array;
  refreshRates: Float32Array;
  nextRefresh: Float32Array;
  lastRefreshTime: Float32Array;
  decayRates: Float32Array;
}

/** Build the instanced character mesh from glyph data arrays (test.html L554-L608). */
export function buildInstancedMesh(
  positions: number[],
  charIndices: number[],
  brightFlags: number[]
): THREE.InstancedMesh {
  const totalChars = positions.length / 3;

  // Pack position & scale arrays for instanced attributes
  const instancePositions = new Float32Array(totalChars * 3);
  const instanceScales = new Float32Array(totalChars * 2);
  for (let i = 0; i < totalChars; i++) {
    instancePositions[i * 3] = positions[i * 3];
    instancePositions[i * 3 + 1] = positions[i * 3 + 1];
    instancePositions[i * 3 + 2] = positions[i * 3 + 2];
    instanceScales[i * 2] = 0.45;
    instanceScales[i * 2 + 1] = 0.38;
  }

  const uvOffsets = computeUVOffsets(charIndices, totalChars);

  const { texture: atlasTex } = buildTextureAtlas();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = createMatrixShaderMaterial(atlasTex);

  const mesh = new THREE.InstancedMesh(geo, mat, totalChars);
  mesh.frustumCulled = false;

  // Attach custom instanced attributes
  mesh.geometry.setAttribute(
    "instancePosition",
    new THREE.InstancedBufferAttribute(instancePositions, 3)
  );
  mesh.geometry.setAttribute(
    "instanceScale",
    new THREE.InstancedBufferAttribute(instanceScales, 2)
  );
  mesh.geometry.setAttribute("instanceUVOffset", new THREE.InstancedBufferAttribute(uvOffsets, 2));
  mesh.geometry.setAttribute(
    "instanceBright",
    new THREE.InstancedBufferAttribute(new Float32Array(brightFlags), 1)
  );

  const alphas = new Float32Array(totalChars).fill(1.0);
  mesh.geometry.setAttribute("instanceAlpha", new THREE.InstancedBufferAttribute(alphas, 1));

  // Identity matrices for all instances (position is in custom attribute)
  const dummy = new THREE.Object3D();
  for (let i = 0; i < totalChars; i++) {
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;

  // Runtime animation data (overwrites any prior userData)
  mesh.userData = {
    uvOffsets,
    scales: instanceScales,
    alphas,
    charIndices: new Uint16Array(charIndices),
    refreshRates: new Float32Array(totalChars).map(() => 0.8 + Math.random() * 2.5),
    nextRefresh: new Float32Array(totalChars).fill(0),
    lastRefreshTime: new Float32Array(totalChars).fill(0),
    decayRates: new Float32Array(totalChars).map(() => 1.5 + Math.random() * 3.0),
  };

  return mesh;
}

/** Update the matrix character mesh animation (test.html L2105-L2148). */
export function updateMatrixMesh(mesh: THREE.InstancedMesh, _dt: number, t: number): void {
  const ud = mesh.userData as MatrixMeshData;
  if (!ud.charIndices) return;

  const alphas = ud.alphas;
  const scales = ud.scales;
  const uvOffsets = ud.uvOffsets;
  const charIndices = ud.charIndices;

  for (let i = 0; i < mesh.count; i++) {
    if (t >= ud.nextRefresh[i]) {
      // Refresh: pick new char from actual character set, reset alpha
      const newCharIdx = Math.floor(Math.random() * CHARS.length);
      charIndices[i] = newCharIdx;

      // Update UV offset for new character
      const col = newCharIdx % ATLAS_COLS;
      const row = Math.floor(newCharIdx / ATLAS_COLS);
      uvOffsets[i * 2] = col / ATLAS_COLS;
      uvOffsets[i * 2 + 1] = row / ATLAS_ROWS;

      ud.nextRefresh[i] = t + ud.refreshRates[i];
      alphas[i] = 1.0;
      ud.lastRefreshTime[i] = t;
    }

    // Linear decay based on elapsed time since last refresh, floor at 0.01
    const i2 = i * 2;
    if (alphas[i] > 0.01) {
      const elapsedSinceRefresh = t - ud.lastRefreshTime[i];
      alphas[i] = Math.max(0.01, 1.0 - elapsedSinceRefresh / ud.decayRates[i]);

      // Reset scales (matches original — no-op but keeps attribute in sync)
      scales[i2] = 0.45;
      scales[i2 + 1] = 0.38;
    }
  }

  mesh.geometry.attributes.instanceUVOffset.needsUpdate = true;
  mesh.geometry.attributes.instanceScale.needsUpdate = true;
  mesh.geometry.attributes.instanceAlpha.needsUpdate = true;
  (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
}
