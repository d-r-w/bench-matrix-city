// Volumetric scanner beam (test.html L714-L803)
export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    uniform float uTime;
    uniform float uProximity;
    varying vec2 vUv;

    // Simple hash for scan-line noise
    float hash(float n) { return fract(sin(n) * 43758.5453); }

    void main() {
        vec3 green = vec3(0.0, 1.0, 0.25);
        vec3 brightGreen = vec3(0.15, 1.0, 0.4);
        vec3 red = vec3(1.0, 0.08, 0.05);
        vec3 brightRed = vec3(1.0, 0.25, 0.15);

        vec3 baseGreen = mix(green, red, uProximity);
        vec3 brightColor = mix(brightGreen, brightRed, uProximity);

        // Base cone fade — brighter at bottom (ground)
        float heightFade = 1.0 - vUv.y;

        // Radial falloff — center of beam is brightest
        float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
        radial = smoothstep(0.0, 1.0, radial);

        // ── Scanning horizontal band that sweeps up and down ──
        float scanPos = fract(uTime * 0.6);
        float scanDist = abs(vUv.y - scanPos);
        float scanLine = smoothstep(0.04, 0.0, scanDist);
        // Secondary thinner bright line
        float thinScan = smoothstep(0.012, 0.0, scanDist);

        // ── Vertical scan lines (like a radar grid) ──
        float vLines = step(0.92, fract(vUv.x * 12.0 + uTime * 0.5));

        // ── Random data flicker in the beam ──
        float cellX = floor(vUv.x * 8.0);
        float cellY = floor((1.0 - vUv.y) * 20.0);
        float cellId = cellX + cellY * 8.0;
        float flicker = step(0.7, hash(cellId + floor(uTime * 3.0)));

        // ── Compose alpha ──
        float baseAlpha = heightFade * radial * 0.04;
        float scanAlpha = scanLine * heightFade * 0.18 + thinScan * heightFade * 0.25;
        float vLineAlpha = vLines * radial * heightFade * 0.03;
        float flickerAlpha = flicker * radial * heightFade * 0.02;

        float alpha = baseAlpha + scanAlpha + vLineAlpha + flickerAlpha;

        // Color: bright on the scan line, standard elsewhere — green or red based on proximity
        vec3 col = mix(baseGreen, brightColor, scanLine + thinScan * 0.5);
        vec3 vLineColor = mix(vec3(0.1, 0.3, 0.1), vec3(0.4, 0.05, 0.02), uProximity);
        col += vLines * vLineColor;

        // Pulse the whole beam subtly (faster pulse when red/alert)
        float pulseFreq = mix(2.5, 6.0, uProximity);
        float pulse = 0.85 + 0.15 * sin(uTime * pulseFreq);
        alpha *= pulse;

        gl_FragColor = vec4(col, alpha);
    }
`;

export interface SearchlightUniforms {
  uTime: { value: number };
  uProximity: { value: number };
}
