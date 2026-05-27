// Laser beam halo — wider, softer red glow (GLSL)

export const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uLife; // 0..1 life of the laser beam
  uniform vec3 uColor;

  void main() {
    // Soft radial glow
    float dist = abs(vUv.x - 0.5) * 2.0;
    float radial = pow(1.0 - dist, 2.0);

    float alpha = radial * 0.35 * uLife;
    gl_FragColor = vec4(uColor, alpha);
  }
`;
