// Window flicker shader (test.html L1048-L1078)
export const vertexShader = `
    attribute float instanceBright;
    attribute float instancePhase;
    attribute float instanceFreq;
    varying float vBright;
    varying float vPhase;
    varying float vFreq;
    void main() {
        vBright = instanceBright;
        vPhase = instancePhase;
        vFreq = instanceFreq;
        vec4 worldPos = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

export const fragmentShader = `
    uniform float uTime;
    varying float vBright;
    varying float vPhase;
    varying float vFreq;
    void main() {
        vec3 green = vec3(0.0, 0.9, 0.25);
        vec3 amber = vec3(1.0, 0.6, 0.1);
        vec3 col = vBright > 1.5 ? amber : green;

        float flicker = 0.8 + 0.2 * sin(uTime * vFreq + vPhase);
        float alpha = 0.5 * flicker;

        gl_FragColor = vec4(col, alpha);
    }
`;

export interface WindowGridUniforms {
  uTime: { value: number };
}
