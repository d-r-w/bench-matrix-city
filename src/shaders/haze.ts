// Noise-based haze layer shader (test.html L1720-L1764)
export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    uniform float uTime;
    uniform float uLayer;
    varying vec2 vUv;

    // Simplex-like noise
    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(hash(i), hash(i + vec2(1,0)), f.x),
            mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
            f.y
        );
    }

    void main() {
        vec2 uv = vUv * 3.0;
        float n = noise(uv + uTime * (0.1 + uLayer * 0.05));
        float n2 = noise(uv * 2.0 - uTime * (0.15 + uLayer * 0.03));
        float haze = n * n2;

        vec2 centerDist = abs(vUv - 0.5) * 2.0;
        float fade = 1.0 - smoothstep(0.3, 0.7, max(centerDist.x, centerDist.y));

        float alpha = haze * fade * (0.015 + uLayer * 0.008);
        vec3 col = mix(vec3(0.0, 0.8, 0.2), vec3(0.15, 0.9, 0.6), n);
        gl_FragColor = vec4(col, alpha);
    }
`;

export interface HazeUniforms {
  uTime: { value: number };
  uLayer: { value: number };
}
