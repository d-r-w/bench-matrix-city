// Camera shake — intensity-based with exponential decay (applied as position offset)
import * as THREE from "three";

const SHAKE_DECAY = 4.0; // per-second decay rate (higher = faster settle)
const SHAKE_MAX_DURATION = 1.5; // seconds before we consider it fully settled

let shakeIntensity = 0.0;
let shakeTimer = 0.0;

// Reusable vectors to avoid GC pressure in the render loop
const _offset = new THREE.Vector3();
const _basePos = new THREE.Vector3();

/**
 * Trigger a camera shake with the given intensity.
 * Multiple calls stack additively for compound impacts.
 * @param intensity  Shake strength (default: 1.0 — moderate building hit)
 */
export function triggerShake(intensity: number = 1.0): void {
  shakeIntensity += intensity;
  shakeTimer = SHAKE_MAX_DURATION; // reset timer so decay has time to breathe
}

/**
 * Apply the current shake offset to the camera position.
 * Call this in your render loop every frame.
 */
export function updateCameraShake(camera: THREE.PerspectiveCamera, dt: number): void {
  if (shakeIntensity < 0.001 && shakeTimer <= 0) return;

  // Decay intensity exponentially
  shakeIntensity *= Math.exp(-SHAKE_DECAY * dt);
  shakeTimer -= dt;

  if (shakeIntensity < 0.001) {
    shakeIntensity = 0;
    return;
  }

  // Store the "true" camera position before we offset it
  _basePos.copy(camera.position);

  // Random jitter scaled by remaining intensity
  const scale = shakeIntensity * 0.4; // dampen multiplier for tasteful shake
  _offset.set(
    (Math.random() - 0.5) * 2 * scale,
    (Math.random() - 0.5) * 2 * scale * 0.6, // slightly less vertical shake
    (Math.random() - 0.5) * 2 * scale
  );

  camera.position.add(_offset);
}

/**
 * Restore the camera to its base position after shake offset was applied.
 * Call this AFTER rendering but BEFORE any logic that reads camera.position,
 * or simply let the flythrough module overwrite camera.position next frame.
 *
 * NOTE: In our setup the flythrough loop runs via rAF and overwrites
 * camera.position each frame, so we don't need to restore — the offset
 * is applied on top of whatever position the flythrough set.
 */
