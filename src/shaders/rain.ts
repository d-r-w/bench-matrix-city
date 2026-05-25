// Digital rain particle shader (test.html L1637-L1668)
export const vertexShader = `
    attribute float velocity;
    varying float vAlpha;
    void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (120.0 / -mvPosition.z) * velocity;
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = smoothstep(120.0, 20.0, -mvPosition.z);
    }
`;

export const fragmentShader = `
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
        // Create a vertical streak shape for digital rain effect
        vec2 center = gl_PointCoord - 0.5;
        float dist = abs(center.x);
        // Sharper, longer streaks with trailing fade
        float streak = smoothstep(0.45, 0.1, dist) * (1.0 - abs(center.y));
        float trail = smoothstep(0.5, 0.0, center.y) * 0.6;
        float alpha = (streak + trail) * vAlpha * 0.2;
        if (alpha < 0.01) discard;

        // Brighter core, softer edges
        vec3 col = mix(uColor * 0.4, uColor * 1.0, streak);
        gl_FragColor = vec4(col, alpha);
    }
`;

export interface RainUniforms {
  uTime: { value: number };
  uColor: { value: THREE.Color };
}
