// Building-face glyph shader (test.html L463-L530)
export const vertexShader = `
    attribute vec3 instancePosition;
    attribute vec2 instanceScale;
    attribute vec2 instanceUVOffset;
    attribute float instanceBright;
    attribute float instanceAlpha;

    varying vec2 vUv;
    varying float vBright;
    varying float vAlpha;

    void main() {
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

        vec3 worldPos = instancePosition
            + (position.x * instanceScale.x) * right
            + (position.y * instanceScale.y) * up;

        vUv     = uv * vec2(1.0/32.0, 1.0/16.0) + instanceUVOffset;
        vBright = instanceBright;
        vAlpha  = instanceAlpha;

        gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
    }
`;

export const fragmentShader = `
    uniform sampler2D uAtlas;
    uniform float uTime;
    varying vec2 vUv;
    varying float vBright;
    varying float vAlpha;

    void main() {
        vec4 texel = texture(uAtlas, vUv);

        float charAlpha = max(texel.r, max(texel.g, texel.b));
        float scanline = 0.85 + 0.15 * sin(vUv.y * 150.0 + uTime * 5.0);
        float flicker  = 0.92 + 0.08 * sin(uTime * 3.0 + vUv.x * 50.0);

        vec3 col = texel.rgb * vBright;

        float finalAlpha = charAlpha * vBright * vAlpha * scanline * flicker;
        if (finalAlpha < 0.01) discard;

        gl_FragColor = vec4(col, finalAlpha);
    }
`;

export interface MatrixCharUniforms {
  uAtlas: { value: THREE.Texture };
  uTime: { value: number };
}
