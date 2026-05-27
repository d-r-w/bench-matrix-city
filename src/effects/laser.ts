// Red laser beams — fired on click, travel directionally from camera (GLSL + JS)
import * as THREE from "three";

import {
  fragmentShader as coreFragment,
  vertexShader as coreVertex,
} from "../shaders/laser/core.js";
import {
  fragmentShader as haloFragment,
  vertexShader as haloVertex,
} from "../shaders/laser/halo.js";

// ── Laser beam data ────────────────────────────────────────────────

interface LaserBeamRefs {
  coreMat: THREE.ShaderMaterial;
  haloMat: THREE.ShaderMaterial;
  muzzleLight: THREE.PointLight;
}

interface LaserBeam {
  group: THREE.Group;
  direction: THREE.Vector3; // normalized world-space travel direction
  speed: number; // world units / sec
  life: number; // remaining lifetime in seconds
  maxLife: number; // total lifetime
}

const LASER_SPEED = 40; // world units per second (3× slower)
const LASER_MAX_LIFE = 5.0; // seconds before fade-out starts
const LASER_FADE_TIME = 1.2; // seconds to fully fade out
const LASER_LENGTH = 30; // visual beam length in world units (5× longer)
const MAX_ACTIVE = 24; // max simultaneous lasers

const activeLasers: LaserBeam[] = [];

// Reusable vectors (avoid GC pressure)
const _up = new THREE.Vector3(0, 1, 0);

// ── Build materials (shared templates) ─────────────────────────────

function makeCoreMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLife: { value: 1.0 },
      uColor: { value: new THREE.Color(0xff0a2e) }, // vivid red
    },
    vertexShader: coreVertex,
    fragmentShader: coreFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

function makeHaloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLife: { value: 1.0 },
      uColor: { value: new THREE.Color(0xff2040) }, // softer red glow
    },
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Fire a red laser from the camera toward a screen-space click point.
 * @param camera  The active PerspectiveCamera
 * @param ndcX    Normalized device coordinate X (-1..+1), 0 = center
 * @param ndcY    Normalized device coordinate Y (-1..+1), 0 = center
 */
export function fireLaser(camera: THREE.PerspectiveCamera, ndcX: number, ndcY: number): void {
  // Cap active lasers to avoid memory issues
  if (activeLasers.length >= MAX_ACTIVE) {
    const oldest = activeLasers.shift();
    if (oldest?.group.parent) oldest.group.parent.remove(oldest.group);
  }

  // Compute aim direction from NDC offset.
  // We unproject the click point to get a world-space direction relative to camera view.
  const ndcVec = new THREE.Vector3(ndcX, ndcY, 0);
  ndcVec.unproject(camera);

  // Direction from camera through the clicked screen point
  const lookDir = ndcVec.clone().sub(camera.position).normalize();

  // Create laser group at camera position
  const group = new THREE.Group();
  group.position.copy(camera.position);

  // Orient the group so +Y points along travel direction
  // Cylinder geometry is oriented along Y by default
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(_up, lookDir);
  group.quaternion.copy(quaternion);

  // Core beam (narrow cylinder)
  const coreGeo = new THREE.CylinderGeometry(0.06, 0.12, LASER_LENGTH, 8, 1, true);
  coreGeo.translate(0, LASER_LENGTH / 2, 0); // pivot at base
  const coreMat = makeCoreMaterial();
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  group.add(coreMesh);

  // Halo (wider glow)
  const haloGeo = new THREE.CylinderGeometry(0.16, 0.3, LASER_LENGTH, 8, 1, true);
  haloGeo.translate(0, LASER_LENGTH / 2, 0);
  const haloMat = makeHaloMaterial();
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  group.add(haloMesh);

  // Muzzle flash point light (brief)
  const muzzleLight = new THREE.PointLight(0xff1030, 2.0, 15);
  muzzleLight.position.set(0, 0.5, 0);
  group.add(muzzleLight);

  // Store refs in userData for typed access during update
  (group.userData as LaserBeamRefs).coreMat = coreMat;
  (group.userData as LaserBeamRefs).haloMat = haloMat;
  (group.userData as LaserBeamRefs).muzzleLight = muzzleLight;

  const laser: LaserBeam = {
    group,
    direction: lookDir.clone(),
    speed: LASER_SPEED,
    life: LASER_MAX_LIFE,
    maxLife: LASER_MAX_LIFE,
  };

  activeLasers.push(laser);

  // Add to scene via global reference
  const scene = getScene();
  if (scene) {
    scene.add(group);
  }
}

/** Update all active lasers: move forward, fade, remove dead ones. */
export function updateLasers(dt: number, elapsed: number): void {
  for (let i = activeLasers.length - 1; i >= 0; i--) {
    const laser = activeLasers[i];
    laser.life -= dt;

    if (laser.life <= 0) {
      // Remove dead laser
      if (laser.group.parent) laser.group.parent.remove(laser.group);
      activeLasers.splice(i, 1);
      continue;
    }

    // Move forward along direction
    const moveDist = laser.speed * dt;
    laser.group.position.addScaledVector(laser.direction, moveDist);

    // Compute normalized life (0..1) for shader uniforms
    // Fade out during last LASER_FADE_TIME seconds
    const fadeStart = laser.maxLife - LASER_FADE_TIME;
    const alpha = laser.life > fadeStart ? 1.0 : Math.max(0, laser.life / LASER_FADE_TIME);

    // Update core material uniforms
    const coreMat = (laser.group.userData as LaserBeamRefs).coreMat;
    if (coreMat?.uniforms) {
      coreMat.uniforms.uTime.value = elapsed;
      coreMat.uniforms.uLife.value = alpha;
    }

    // Update halo material uniforms
    const haloMat = (laser.group.userData as LaserBeamRefs).haloMat;
    if (haloMat?.uniforms) {
      haloMat.uniforms.uLife.value = alpha * 0.7;
    }

    // Muzzle light fades quickly
    const muzzleLight = (laser.group.userData as LaserBeamRefs).muzzleLight;
    if (muzzleLight) {
      const lifeRatio = Math.max(0, laser.life / laser.maxLife);
      muzzleLight.intensity = lifeRatio * 2.0;
    }
  }
}

/** Remove all active lasers (cleanup). */
export function clearLasers(): void {
  for (const laser of activeLasers) {
    if (laser.group.parent) laser.group.parent.remove(laser.group);
  }
  activeLasers.length = 0;
}

// ── Helpers ────────────────────────────────────────────────────────

function getScene(): THREE.Scene | null {
  return (window as unknown as Record<string, unknown>).__matrixCityScene as THREE.Scene | null;
}
