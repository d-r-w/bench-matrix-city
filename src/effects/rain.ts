// Digital rain particles (test.html L1610-L1683, update L2155-L2168)
import * as THREE from "three";

import { CELL, GRID } from "../constants.js";
import { fragmentShader, vertexShader } from "../shaders/rain.js";

// ── Build ────────────────────────────────────────────────────────

export function buildRain(scene: THREE.Scene): void {
  const count = 6000;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * GRID * CELL * 4;
    positions[i * 3 + 1] = Math.random() * 150;
    positions[i * 3 + 2] = (Math.random() - 0.5) * GRID * CELL * 4;
    velocities[i] = 0.8 + Math.random() * 1.5;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("velocity", new THREE.BufferAttribute(velocities, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00ff41) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const rain = new THREE.Points(geo, mat);
  scene.add(rain);
  window._rain = rain;
}

// ── Update ───────────────────────────────────────────────────────

export function updateRain(dt: number, elapsed: number): void {
  if (!window._rain) return;

  const mat = window._rain.material as THREE.ShaderMaterial;
  mat.uniforms.uTime.value = elapsed;

  const pos = window._rain.geometry.attributes.position;
  const vel = window._rain.geometry.attributes.velocity;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.array[i * 3 + 1];
    y -= vel.array[i] * dt * 14;
    if (y < -5) y = 120;
    pos.array[i * 3 + 1] = y;
  }
  pos.needsUpdate = true;
}
