// Ground-level scan disc (test.html L805-L862)
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

    void main() {
        // Polar coordinates centered on disc
        vec2 center = vUv - 0.5;
        float dist = length(center) * 2.0; // 0..1
        float angle = atan(center.y, center.x);

        vec3 green = vec3(0.0, 1.0, 0.25);
        vec3 brightGreen = vec3(0.2, 1.0, 0.4);
        vec3 red = vec3(1.0, 0.08, 0.05);
        vec3 brightRed = vec3(1.0, 0.3, 0.15);

        vec3 baseGreen = mix(green, red, uProximity);
        vec3 brightColor = mix(brightGreen, brightRed, uProximity);

        // Radial fade — edge of disc is dimmer
        float radialFade = 1.0 - dist;
        radialFade = smoothstep(0.0, 1.0, radialFade);

        // ── Concentric scan rings that expand outward ──
        float ringPos = fract(uTime * 0.5);
        float ringDist2 = abs(dist - ringPos);
        float expandingRing = smoothstep(0.03, 0.0, ringDist2);

        // ── Grid lines on the disc ──
        float gridX = step(0.95, fract(vUv.x * 16.0));
        float gridY = step(0.95, fract(vUv.y * 16.0));
        float grid = max(gridX, gridY);

        // ── Compose alpha ──
        float baseAlpha = radialFade * 0.06;
        float expandAlpha = expandingRing * radialFade * 0.2;
        float gridAlpha = grid * radialFade * 0.04;

        float alpha = baseAlpha + expandAlpha + gridAlpha;

        // Color: bright on expanding rings — green or red based on proximity
        vec3 col = mix(baseGreen, brightColor, expandingRing);

        gl_FragColor = vec4(col, alpha);
    }
`;

export interface GroundDiscUniforms {
  uTime: { value: number };
  uProximity: { value: number };
}
