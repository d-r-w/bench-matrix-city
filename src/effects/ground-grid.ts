// Ground grid + stream sprites (test.html L1519-L1608, update L2151-L2153 & L2283-L2314)
import * as THREE from "three";

import { CELL, GRID, randChar } from "../constants.js";
import { getCharTex } from "../textures/char-texture.js";
import type { StreamSpriteData } from "../types.js";

// ── Build ────────────────────────────────────────────────────────

export function buildGroundGrid(scene: THREE.Scene): void {
  const size = GRID * CELL;

  // Ground plane with shader grid lines
  const groundGeo = new THREE.PlaneGeometry(size * 2.5, size * 2.5);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00ff41) },
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;

        void main() {
            // Sparse grid — only major lines every ~20 cells worth of UV
            vec2 grid = abs(fract(vUv * 20.0 - 0.5) - 0.5);
            float line = min(grid.x, grid.y);
            float gridAlpha = 1.0 - smoothstep(0.0, 0.012, line);

            // Subtle animated scan along grid lines
            float stream = abs(fract(vUv.x * 2.0 + uTime * 0.05) - 0.5);
            float streamAlpha = (1.0 - smoothstep(0.0, 0.02, stream)) * 0.5;

            float dist = distance(vUv, vec2(0.5));
            float fade = 1.0 - smoothstep(0.2, 0.5, dist);

            float totalAlpha = (gridAlpha * fade + streamAlpha) * 0.5;
            gl_FragColor = vec4(uColor, totalAlpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const groundPlane = new THREE.Mesh(groundGeo, groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = 0.01;
  scene.add(groundPlane);

  window._groundPlane = groundPlane;

  // Road edges at every even grid line (roads on the grid lines)
  const isRoad = (i: number) => i % 2 === 0;
  const avenueEdgeMat = new THREE.LineBasicMaterial({
    color: 0x22ff66,
    transparent: true,
    opacity: 0.3,
  });

  for (let i = -GRID; i <= GRID; i++) {
    if (!isRoad(i)) continue;
    const pos = i * CELL;

    for (const sign of [-1, 1] as const) {
      const zOff = pos + sign * CELL * 0.42;
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-size, 0.04, zOff),
            new THREE.Vector3(size, 0.04, zOff),
          ]),
          avenueEdgeMat
        )
      );
    }

    for (const sign of [-1, 1] as const) {
      const xOff = pos + sign * CELL * 0.42;
      scene.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(xOff, 0.04, -size),
            new THREE.Vector3(xOff, 0.04, size),
          ]),
          avenueEdgeMat
        )
      );
    }
  }

  // Sparse data stream chars along avenues only
  const streamChars = 150;
  for (let i = 0; i < streamChars; i++) {
    const ch = randChar();
    const tex = getCharTex(ch, { bright: Math.random() > 0.7, size: 50 });
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0.25 + Math.random() * 0.15,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.6, 1);

    const roadIdx = Math.floor((Math.random() * 2 - 1) * ((GRID / 2) | 0));
    const roadPos = roadIdx * 2 * CELL;

    if (Math.random() > 0.5) {
      sprite.position.set((Math.random() - 0.5) * size * 2, 0.1, roadPos);
    } else {
      sprite.position.set(roadPos, 0.1, (Math.random() - 0.5) * size * 2);
    }

    sprite.userData.streamSpeed = 0.5 + Math.random() * 1.5;
    sprite.userData.streamDir = Math.random() > 0.5 ? 1 : -1;
    sprite.userData.streamAxis = Math.random() > 0.5 ? ("x" as const) : ("z" as const);
    scene.add(sprite);
  }

  window._streamSprites = scene.children.filter(
    (c): c is THREE.Sprite => c.userData.streamSpeed !== undefined && c instanceof THREE.Sprite
  );
}

// ── Update ───────────────────────────────────────────────────────

export function updateGroundGrid(elapsed: number): void {
  if (window._groundPlane) {
    const mat = window._groundPlane.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = elapsed;
  }
}

export function updateStreamSprites(dt: number, elapsed: number): void {
  const streams = window._streamSprites;
  if (!streams) return;

  const size = GRID * CELL;
  for (const s of streams) {
    const ud = s.userData as StreamSpriteData;
    if (ud.streamSpeed === undefined) continue;

    const move = ud.streamSpeed * ud.streamDir * dt * 10;
    if (ud.streamAxis === "x") {
      s.position.x += move;
      if (Math.abs(s.position.x) > size) {
        s.position.x = -Math.sign(s.position.x) * (size - 1);
      }
    } else {
      s.position.z += move;
      if (Math.abs(s.position.z) > size) {
        s.position.z = -Math.sign(s.position.z) * (size - 1);
      }
    }

    s.position.y = 0.06 + Math.sin(elapsed * 2 + s.position.x * 0.15) * 0.02;
    const pulse = Math.sin(elapsed * 2 + s.position.x * 0.1);
    s.material.opacity = 0.3 + pulse * 0.1;

    if (Math.random() < 0.003) {
      const ch = randChar();
      s.material.map = getCharTex(ch, { bright: Math.random() > 0.6, size: 50 });
    }
  }
}
