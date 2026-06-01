// Radar minimap — green translucent circular overlay with pulsing sweep line
export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uRotation;   // camera heading in radians
  // World-space radius the radar covers (half-width of the map area)
  uniform float uWorldRadius;

  // Buildings: x, z packed into xy
  #define MAX_BUILDINGS 256
  uniform vec4 uBuildingPos[MAX_BUILDINGS];
  uniform int uBuildingCount;

  // Drones: x, z, state (0 = taking off, 1 = patrolling)
  #define MAX_DRONES 12
  uniform vec3 uDroneData[MAX_DRONES];
  uniform int uDroneCount;

  // Dying drones: x, z, diedAt
  #define MAX_DYING 12
  uniform vec3 uDyingData[MAX_DYING];
  uniform int uDyingCount;

  void main() {
    // UV center of the plane = (0.5, 0.5)
    vec2 center = vec2(0.5);
    vec2 offset = vUv - center;
    float dist = length(offset);

    // Normalized radial coordinate (0 = center, 1 = edge)
    float r = dist / 0.5;

    if (r > 1.0) discard;

    // Direction from center (normalized)
    vec2 dir = offset / max(dist, 0.001);

    // Map radial distance to world-space position on the map
    vec2 worldPos = dir * r * uWorldRadius;

    // ── Base color: dark green with subtle gradient ──
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    vec3 bg = mix(vec3(0.0, 0.04, 0.01), vec3(0.0, 0.08, 0.02), r);

    // ── Edge glow (pulsing ring) ──
    float edgeGlow = smoothstep(0.85, 1.0, r);
    float edgePulse = sin(uTime * 3.0 + r * 6.28) * 0.5 + 0.5;
    bg += vec3(0.0, 0.4, 0.1) * edgeGlow * (0.3 + 0.3 * edgePulse);

    // ── Outer ring border ──
    float ring = smoothstep(0.96, 1.0, r) - smoothstep(1.0, 1.02, r);
    bg += vec3(0.0, 0.8, 0.2) * ring * (0.7 + 0.3 * pulse);

    // ── Concentric range rings ──
    for (int i = 1; i <= 3; i++) {
      float ri = float(i) / 4.0;
      float ringLine = smoothstep(ri - 0.008, ri, r) - smoothstep(ri, ri + 0.008, r);
      bg += vec3(0.0, 0.35, 0.08) * ringLine * 0.4;
    }

    // ── Crosshair lines ──
    float hLine = smoothstep(0.006, 0.0, abs(dir.y)) * (1.0 - smoothstep(0.9, 1.0, r));
    float vLine = smoothstep(0.006, 0.0, abs(dir.x)) * (1.0 - smoothstep(0.9, 1.0, r));
    bg += vec3(0.0, 0.25, 0.06) * max(hLine, vLine) * 0.3;

    // ── Sweep line (rotating radar beam, offset by camera heading) ──
    float sweepAngle = uTime * 1.2 + uRotation;
    vec2 sweepDir = vec2(cos(sweepAngle), sin(sweepAngle));
    float dotProd = dot(dir, sweepDir);

    // Leading edge glow
    float sweepLine = smoothstep(0.96, 1.0, dotProd) * (1.0 - smoothstep(0.0, 0.15, r));
    float sweepGlow = pow(max(dotProd, 0.0), 8.0) * (1.0 - r * 0.7);
    bg += vec3(0.0, 1.0, 0.25) * (sweepLine * 0.9 + sweepGlow * 0.4);

    // Sweep trail (fading wedge behind the line)
    float trail = pow(max(dotProd, 0.0), 3.0) * smoothstep(-0.15, 0.0, dotProd);
    bg += vec3(0.0, 0.5, 0.12) * trail * 0.2;

    // ── Buildings (small green squares) ──
    for (int i = 0; i < MAX_BUILDINGS; i++) {
      if (i >= uBuildingCount) break;
      vec2 bPos = uBuildingPos[i].xy;
      float size = 0.018; // NDC square half-size in UV space
      vec2 diff = worldPos - bPos;
      vec2 uvDiff = diff / (uWorldRadius * 2.0);
      float bx = smoothstep(size, size - 0.003, abs(uvDiff.x));
      float by = smoothstep(size, size - 0.003, abs(uvDiff.y));
      bg += vec3(0.0, 0.55, 0.12) * bx * by;
    }

    // ── Active drones (blip when sweep passes, then fade — real radar style) ──
    for (int i = 0; i < MAX_DRONES; i++) {
      if (i >= uDroneCount) break;
      vec2 dPos = uDroneData[i].xy;
      float state = uDroneData[i].z;

      // Drone angle in radar display coords (same space as sweepAngle)
      // GLSL ES 1.0 lacks atan2 — use atan(y/x) with quadrant fix
      float PI = 3.14159265;
      float droneAngle = dPos.x != 0.0 ? atan(dPos.y / dPos.x) : (dPos.y > 0.0 ? PI * 0.5 : -PI * 0.5);
      if (dPos.x < 0.0) droneAngle += PI;
      // Signed angle: how far the sweep has rotated past this drone [0..2π)
      // 0 = just swept → bright blip, π = half rotation ago → dim
      float anglePast = fract((sweepAngle - droneAngle) / 6.28318 + 100.0) * 6.28318;
      float phase = anglePast / 6.28318; // [0, 1)

      // Bright blip right after sweep passes, exponential decay over ~80% of rotation (slower fade)
      float blipIntensity = exp(-phase * 4.5);
      // Minimum visibility so dots aren't invisible for long stretches
      float minVisibility = 0.1;
      float dronePulse = mix(minVisibility, 1.0, blipIntensity);

      vec2 diff = worldPos - dPos;
      vec2 uvDiff = diff / (uWorldRadius * 2.0);
      float dDist = length(uvDiff);

      // Dot
      float dotSize = 0.012;
      float dotCircle = smoothstep(dotSize, dotSize - 0.004, dDist);

      // Glow halo (also fades with sweep)
      float glow = exp(-dDist * 80.0) * 0.6;

      vec3 droneColor = state < 0.5
        ? vec3(1.0, 0.95, 0.0)   // yellow = taking off
        : vec3(1.0, 0.08, 0.0);  // red = patrolling

      bg += droneColor * (dotCircle * 1.0 + glow) * dronePulse;
    }

    // ── Dying drones (red X mark, fades over ~5s) ──
    for (int i = 0; i < MAX_DYING; i++) {
      if (i >= uDyingCount) break;
      vec2 dPos = uDyingData[i].xy;
      float diedAt = uDyingData[i].z;
      float age = uTime - diedAt;
      // Fully visible for ~3.5s, then fade out over the last 1.5s
      float alpha = 1.0 - smoothstep(3.5, 5.0, age);

      if (alpha < 0.01) continue;

      vec2 diff = worldPos - dPos;
      vec2 uvDiff = diff / (uWorldRadius * 2.0);

      // X mark: two crossing diagonal lines within a circular boundary
      float xSize = 0.025;
      float halfWidth = 0.006;
      float diagDist = abs(uvDiff.x + uvDiff.y);
      float antiDiagDist = abs(uvDiff.x - uvDiff.y);
      // Closer to either diagonal → smaller minDist
      float minDiagDist = min(diagDist, antiDiagDist);
      float xLine = smoothstep(halfWidth, 0.0, minDiagDist);
      // Clamp X arms inside a circle so they don't stretch forever
      float radialMask = smoothstep(xSize, xSize - 0.002, length(uvDiff));
      bg += vec3(1.0, 0.05, 0.0) * xLine * radialMask * alpha;
    }

    // ── Final alpha: fade at edges for soft circular look ──
    float alpha = smoothstep(1.0, 0.88, r);
    gl_FragColor = vec4(bg, alpha * 0.75);
  }
`;
