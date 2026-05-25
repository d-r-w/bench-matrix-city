// Red-blue rotating halo ring (test.html L659-L712)
export const vertexShader = `
    varying vec3 vLocalPos;
    void main() {
        vLocalPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const fragmentShader = `
    uniform float uTime;
    varying vec3 vLocalPos;

    void main() {
        // Torus ring lies in XY plane — compute angle around Z axis
        float angle = atan(vLocalPos.y, vLocalPos.x);

        // Rotate the color pattern over time
        float rotAngle = angle - uTime * 2.5;

        // Create alternating red/blue segments (8 segments total)
        float seg = mod(rotAngle + 3.14159, 6.28318) / (6.28318 / 8.0);
        float isRed = step(0.5, fract(seg));

        vec3 redColor = vec3(1.0, 0.1, 0.1);
        vec3 blueColor = vec3(0.1, 0.2, 1.0);
        vec3 col = mix(blueColor, redColor, isRed);

        // Pulsing intensity
        float pulse = 0.6 + 0.4 * sin(uTime * 5.0);

        float alpha = pulse;

        gl_FragColor = vec4(col, alpha);
    }
`;

export interface HaloRingUniforms {
  uTime: { value: number };
}
