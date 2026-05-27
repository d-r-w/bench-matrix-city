// Explosion / impact effects for laser collisions (GLSL + JS)
import * as THREE from "three";

const MAX_EXPLOSIONS = 32;
const PARTICLES_PER_BURST = 40;
const BURST_LIFETIME = 1.5; // seconds
const FLASH_DURATION = 0.3; // seconds for the initial flash light

interface ExplosionParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ExplosionData {
  group: THREE.Group;
  particles: ExplosionParticle[];
  particlePoints: THREE.Points;
  flashLight: THREE.PointLight | null;
  flashTimer: number; // remaining time for flash light
  flashMaxIntensity: number; // peak intensity for fade curve
  scorchMark: THREE.Mesh | null;
  age: number;
}

const activeExplosions: ExplosionData[] = [];

// ── Particle shader material (shared) ───────────────────────────────

function makeParticleMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xff4422) },
    },
    vertexShader: /* glsl */ `
      attribute float aLife; // 0..1 normalized life remaining
      varying float vLife;
      void main() {
        vLife = aLife;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(6.0 * (1.0 / -mvPos.z) * vLife * 80.0, 1.0, 24.0);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying float vLife;
      uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0; // 0..1
        if (d > 1.0) discard;
        float glow = pow(1.0 - d, 2.0);
        vec3 col = mix(uColor, vec3(1.0, 0.95, 0.7), glow * 0.5);
        gl_FragColor = vec4(col, glow * vLife);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ── Scorch mark material (shared) ───────────────────────────────────

function makeScorchMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uLife: { value: 1.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec2 vUv;
      uniform float uLife;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        if (d > 1.0) discard;
        // Dark center with glowing red ring
        float ring = smoothstep(0.3, 0.6, d) * (1.0 - smoothstep(0.6, 1.0, d));
        vec3 col = mix(vec3(0.02), vec3(0.8, 0.15, 0.05), ring);
        float alpha = (ring + 0.1) * uLife;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ── Public API ──────────────────────────────────────────────────────

/** Tunable explosion parameters. */
interface ExplosionOptions {
  /** Number of particles (default: 40) */
  particleCount?: number;
  /** Velocity spread multiplier (default: 1.0) */
  velocityScale?: number;
  /** Burst lifetime in seconds (default: 1.5) */
  burstLifetime?: number;
  /** Flash light peak intensity (default: 8) */
  flashIntensity?: number;
  /** Flash light radius (default: 20) */
  flashRadius?: number;
  /** Scorch mark size (default: 1.2) */
  scorchSize?: number;
  /** Explosion color (default: red-orange) */
  color?: THREE.Color;
}

/**
 * Spawn an explosion effect at the given world position.
 * @param scene       The Three.js scene to add the effect to
 * @param point       World-space impact position
 * @param normal      Approximate surface normal (for scorch mark orientation)
 * @param options     Tunable explosion parameters
 */
export function spawnExplosion(
  scene: THREE.Scene,
  point: THREE.Vector3,
  normal?: THREE.Vector3,
  options: ExplosionOptions = {}
): void {
  const particleCount = options.particleCount ?? PARTICLES_PER_BURST;
  const velScale = options.velocityScale ?? 1.0;
  const burstLifetime = options.burstLifetime ?? BURST_LIFETIME;
  const flashIntensity = options.flashIntensity ?? 8;
  const flashRadius = options.flashRadius ?? 20;
  const scorchSize = options.scorchSize ?? 1.2;
  const color = options.color ?? new THREE.Color(0xff4422);

  // Recycle oldest if at capacity
  if (activeExplosions.length >= MAX_EXPLOSIONS) {
    const old = activeExplosions.shift();
    if (old) {
      removeExplosionFromScene(old, scene);
    }
  }

  const group = new THREE.Group();
  group.position.copy(point);

  // ── Particle burst ────────────────────────────────────────
  const positions = new Float32Array(particleCount * 3);
  const lives = new Float32Array(particleCount);
  const particles: ExplosionParticle[] = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
    lives[i] = 1.0;

    // Random velocity in a hemisphere (biased toward outward from surface)
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 8 * velScale,
      Math.random() * 6 * velScale + 2,
      (Math.random() - 0.5) * 8 * velScale
    );

    particles.push({
      position: new THREE.Vector3(),
      velocity: vel,
      life: burstLifetime * (0.5 + Math.random() * 0.5), // vary individual lifetimes
      maxLife: burstLifetime,
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aLife", new THREE.BufferAttribute(lives, 1));

  const mat = makeParticleMaterial();
  mat.uniforms.uColor.value.copy(color);
  const points = new THREE.Points(geo, mat);
  group.add(points);

  // ── Flash light (brief bright burst) ──────────────────────
  const flashLight = new THREE.PointLight(0xff6633, flashIntensity, flashRadius);
  group.add(flashLight);

  // ── Scorch mark on surface ────────────────────────────────
  let scorchMark: THREE.Mesh | null = null;
  if (normal) {
    const scorchGeo = new THREE.PlaneGeometry(scorchSize, scorchSize);
    const scorchMat = makeScorchMaterial();
    scorchMark = new THREE.Mesh(scorchGeo, scorchMat);

    // Orient to face the normal direction (slightly offset from surface)
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    scorchMark.quaternion.copy(quat);
    scorchMark.position.copy(normal.clone().multiplyScalar(-0.05)); // push into surface slightly

    group.add(scorchMark);
  }

  const explosion: ExplosionData = {
    group,
    particles,
    particlePoints: points,
    flashLight,
    flashTimer: FLASH_DURATION,
    flashMaxIntensity: flashIntensity,
    scorchMark,
    age: 0,
  };

  activeExplosions.push(explosion);
  scene.add(group);
}

/** Update all active explosions. */
export function updateExplosions(dt: number, _elapsed: number): void {
  for (let i = activeExplosions.length - 1; i >= 0; i--) {
    const exp = activeExplosions[i];
    exp.age += dt;

    // ── Update particles ────────────────────────────────────
    const posAttr = exp.particlePoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    const lifeAttr = exp.particlePoints.geometry.getAttribute("aLife") as THREE.BufferAttribute;

    let allDead = true;
    for (let j = 0; j < exp.particles.length; j++) {
      const p = exp.particles[j];
      p.life -= dt;

      if (p.life <= 0) {
        // Hide dead particle by moving it far away and zeroing life
        posAttr.setXYZ(j, 0, -1000, 0);
        lifeAttr.setX(j, 0);
        continue;
      }

      allDead = false;

      // Integrate velocity (gravity pull down)
      p.velocity.y -= 9.8 * dt * 0.3; // light gravity for floating embers
      p.position.addScaledVector(p.velocity, dt);

      posAttr.setXYZ(j, p.position.x, p.position.y, p.position.z);
      lifeAttr.setX(j, Math.max(0, p.life / p.maxLife));
    }

    posAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;

    // ── Flash light fades quickly ───────────────────────────
    if (exp.flashLight) {
      exp.flashTimer -= dt;
      if (exp.flashTimer <= 0) {
        exp.flashLight.intensity = 0;
      } else {
        exp.flashLight.intensity = (exp.flashTimer / FLASH_DURATION) * exp.flashMaxIntensity;
      }
    }

    // ── Scorch mark fades slowly ────────────────────────────
    if (exp.scorchMark && (exp.scorchMark.material as THREE.ShaderMaterial).uniforms?.uLife) {
      const scorchLife = Math.max(0, 1 - exp.age / 4.0); // fade over 4 seconds
      (exp.scorchMark.material as THREE.ShaderMaterial).uniforms.uLife.value = scorchLife;
    }

    // ── Remove dead explosions ──────────────────────────────
    if (allDead && exp.flashTimer <= 0) {
      const scene = getScene();
      removeExplosionFromScene(exp, scene);
      activeExplosions.splice(i, 1);
    }
  }
}

/** Remove all explosions (cleanup). */
export function clearExplosions(): void {
  const scene = getScene();
  for (const exp of activeExplosions) {
    removeExplosionFromScene(exp, scene);
  }
  activeExplosions.length = 0;
}

// ── Helpers ────────────────────────────────────────────────────────

function removeExplosionFromScene(exp: ExplosionData, _scene: THREE.Scene | null): void {
  if (exp.group.parent) exp.group.parent.remove(exp.group);
  // Dispose geometries and materials to avoid leaks
  const points = exp.particlePoints;
  if (points.geometry) points.geometry.dispose();
  if (points.material && !(points.material as THREE.ShaderMaterial).isShaderMaterial) {
    (points.material as THREE.Material).dispose();
  }
}

function getScene(): THREE.Scene | null {
  return (window as unknown as Record<string, unknown>).__matrixCityScene as THREE.Scene | null;
}
