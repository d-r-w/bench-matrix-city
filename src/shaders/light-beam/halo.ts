// Halo glow shader (test.html L1840-L1865)
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
        float alpha = (1.0 - vUv.y) * 0.03;
        float radial = 1.0 - abs(vUv.x - 0.5) * 2.0;
        radial = smoothstep(0.0, 1.0, radial);
        float pulse = 0.8 + 0.2 * sin(uTime * 1.5);
        alpha *= radial * pulse;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

export interface HaloBeamUniforms {
  uTime: { value: number };
  uColor: { value: THREE.Color };
}
