// Haze layers — noise-based atmospheric fog (test.html L1685-L1772, update L2186-L2190)
import * as THREE from "three";

import { CELL, GRID } from "../constants.js";
import { fragmentShader, vertexShader } from "../shaders/haze.js";

// ── Build ────────────────────────────────────────────────────────

export function buildHazeLayers(scene: THREE.Scene): void {
  const hazeMeshes: THREE.Mesh[] = [];

  for (let layer = 0; layer < 3; layer++) {
    const hazeGeo = new THREE.PlaneGeometry(GRID * CELL * 3, GRID * CELL * 3);
    const hazeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uLayer: { value: layer },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const haze = new THREE.Mesh(hazeGeo, hazeMat);
    haze.position.y = 5 + layer * 12;
    scene.add(haze);
    hazeMeshes.push(haze);
  }

  window._hazeLayers = hazeMeshes;
}

// ── Update ───────────────────────────────────────────────────────

export function updateHazeLayers(elapsed: number): void {
  if (!window._hazeLayers) return;
  for (const haze of window._hazeLayers) {
    const mat = haze.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = elapsed;
  }
}
