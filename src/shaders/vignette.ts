// Post-processing vignette + color grading pass (test.html L268-L305)
export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec2 uv = (vUv - 0.5) * 2.0;
        float vig = clamp(offset - dot(uv, uv) * darkness * 0.35, 0.0, 1.0);
        vec3 shadowTint = mix(vec3(0.0, 0.08, 0.02), vec3(1.0), vig);
        texel.rgb *= shadowTint;
        // Slight green tint + contrast curve
        vec3 graded = texel.rgb * vec3(0.95, 1.05, 0.9);
        graded = pow(graded, vec3(1.05));
        texel.rgb = graded;
        gl_FragColor = texel;
    }
`;

export interface VignetteUniforms {
  tDiffuse: { value: THREE.Texture | null };
  darkness: { value: number };
  offset: { value: number };
}
