// Light beams — volumetric columns at avenue intersections (test.html L1793-L1953, update L2170-L2183)
import * as THREE from "three";

import { CELL, GRID } from "../constants.js";
import {
  fragmentShader as charStreamFragment,
  vertexShader as charStreamVertex,
} from "../shaders/light-beam/char-stream.js";
import {
  fragmentShader as coreFragment,
  vertexShader as coreVertex,
} from "../shaders/light-beam/core.js";
import {
  fragmentShader as haloFragment,
  vertexShader as haloVertex,
} from "../shaders/light-beam/halo.js";
import { buildCharStreamTexture } from "../textures/atlas.js";

// ── Build ────────────────────────────────────────────────────────

export function buildLightBeams(scene: THREE.Scene): void {
  const charStreamTex = buildCharStreamTexture();

  // --- Core beam geometry (narrow cylinder) ---
  const beamGeo = new THREE.CylinderGeometry(0.1, 0.6, 100, 8, 1, true);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00ff41) },
    },
    vertexShader: coreVertex,
    fragmentShader: coreFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  // --- Halo geometry (wider, dimmer cylinder for volumetric glow) ---
  const haloGeo = new THREE.CylinderGeometry(0.3, 1.5, 100, 8, 1, true);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00ff41) },
    },
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  // --- Character stream planes (glyphs flowing upward) ---
  const charStreamMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAtlas: { value: charStreamTex },
    },
    vertexShader: charStreamVertex,
    fragmentShader: charStreamFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const isAvenue = (i: number) => Math.abs(i) % 6 === 0;
  const beams: THREE.Group[] = [];

  for (let ix = -GRID; ix <= GRID; ix++) {
    for (let iz = -GRID; iz <= GRID; iz++) {
      if (!isAvenue(ix) || !isAvenue(iz)) continue;

      // Only place a beam ~20% of the time for sparser distribution
      if (Math.random() > 0.2) continue;

      const group = new THREE.Group();
      group.position.set(ix * CELL, 35, iz * CELL);

      // Core beam
      const mat = beamMat.clone();
      mat.uniforms.uTime.value = Math.random() * 10;
      const beam = new THREE.Mesh(beamGeo, mat);
      group.add(beam);

      // Halo (wider glow behind the core)
      const haloMatClone = haloMat.clone();
      haloMatClone.uniforms.uTime.value = Math.random() * 10;
      const halo = new THREE.Mesh(haloGeo, haloMatClone);
      group.add(halo);

      // Character stream planes (4 sides)
      for (let s = 0; s < 4; s++) {
        const csMat = charStreamMat.clone();
        csMat.uniforms.uTime.value = Math.random() * 10;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 100), csMat);
        plane.rotation.y = (s * Math.PI) / 2;
        plane.position.x = Math.cos((s * Math.PI) / 2) * 0.7;
        plane.position.z = Math.sin((s * Math.PI) / 2) * 0.7;
        group.add(plane);
      }

      scene.add(group);
      beams.push(group);
    }
  }

  window._lightBeams = beams;
}

// ── Update ───────────────────────────────────────────────────────

export function updateLightBeams(dt: number, elapsed: number): void {
  if (!window._lightBeams) return;

  for (const group of window._lightBeams) {
    // Subtle rotation and height pulse for dynamic atmosphere
    group.rotation.y += dt * 0.04;
    group.position.y = 40 + Math.sin(elapsed * 0.3 + group.id) * 2;

    // Update time uniforms on all children (core, halo, char streams)
    for (const child of group.children) {
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.ShaderMaterial | undefined;
      if (mat?.uniforms?.uTime) {
        mat.uniforms.uTime.value = elapsed;
      }
    }
  }
}
