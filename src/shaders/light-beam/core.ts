// Core beam shader (test.html L1798-L1826)
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
        float alpha = (1.0 - vUv.y) * 0.08;
        // Volumetric light falloff from center
        float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
        radial = smoothstep(0.0, 1.0, radial);

        float pulse = 0.7 + 0.3 * sin(uTime * 2.0 + vUv.y * 10.0);
        float flicker = 0.85 + 0.15 * sin(uTime * 7.0 + vUv.y * 20.0);

        alpha *= radial * pulse * flicker;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

export interface CoreBeamUniforms {
  uTime: { value: number };
  uColor: { value: THREE.Color };
}
