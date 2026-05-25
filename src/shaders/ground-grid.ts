// Ground grid line shader (test.html L1538-L1569)
export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;

    void main() {
        // Sparse grid — only major lines every ~20 cells worth of UV
        vec2 grid = abs(fract(vUv * 20.0 - 0.5) - 0.5);
        float line = min(grid.x, grid.y);
        float gridAlpha = 1.0 - smoothstep(0.0, 0.012, line);

        // Subtle animated pulse along grid lines
        float stream = abs(fract(vUv.x * 5.0 + uTime * 0.3) - 0.5);
        float streamAlpha = (1.0 - smoothstep(0.0, 0.04, stream)) * 0.5;

        float dist = distance(vUv, vec2(0.5));
        float fade = 1.0 - smoothstep(0.2, 0.5, dist);

        float totalAlpha = (gridAlpha * fade + streamAlpha) * 0.5;
        gl_FragColor = vec4(uColor, totalAlpha);
    }
`;

export interface GroundGridUniforms {
  uTime: { value: number };
  uColor: { value: THREE.Color };
}
