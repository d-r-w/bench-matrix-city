// Starfield — static hemisphere of colored points (test.html L1774-L1809)
import * as THREE from "three";

// ── Build ────────────────────────────────────────────────────────

export function buildStarfield(scene: THREE.Scene): void {
  const count = 800;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random());
    const r = 150 + Math.random() * 100;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.5 + 20;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const isGreen = Math.random() > 0.3;
    colors[i * 3] = isGreen ? 0.1 : 0.5;
    colors[i * 3 + 1] = isGreen ? 0.8 : 0.5;
    colors[i * 3 + 2] = isGreen ? 0.2 : 0.5;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
}
