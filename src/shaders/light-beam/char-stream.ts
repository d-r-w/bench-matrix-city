// Character stream plane shader (test.html L1873-L1906)
export const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    uniform float uTime;
    uniform sampler2D uAtlas;
    varying vec2 vUv;
    void main() {
        float scrollSpeed = 0.4;
        vec2 uv = vUv;
        uv.y -= fract(uTime * scrollSpeed);
        vec4 texel = texture(uAtlas, uv);
        float fade = sin(vUv.y * 3.14159);
        float alpha = texel.a * fade * 0.12;
        gl_FragColor = vec4(texel.rgb, alpha);
    }
`;

export interface CharStreamUniforms {
  uTime: { value: number };
  uAtlas: { value: THREE.Texture };
}
