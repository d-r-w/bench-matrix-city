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

        // 4 large alternating red/blue segments (2 red + 2 blue) with dark gaps between them
        float seg = mod(rotAngle + 3.14159, 6.28318) / (6.28318 / 4.0);
        float isRed = mod(floor(seg), 2.0);       // alternate red/blue per segment
        float withinSeg = fract(seg);             // 0→1 position inside each segment
        float gapMask = 1.0 - step(0.75, withinSeg); // dark gap for last 25% of each segment

        vec3 redColor = vec3(1.0, 0.1, 0.1);
        vec3 blueColor = vec3(0.1, 0.2, 1.0);
        vec3 col = mix(blueColor, redColor, isRed * gapMask);

        // Pulsing intensity
        float pulse = 0.6 + 0.4 * sin(uTime * 5.0);

        float alpha = pulse * gapMask;

        gl_FragColor = vec4(col, alpha);
    }
`;

export interface HaloRingUniforms {
  uTime: { value: number };
}
