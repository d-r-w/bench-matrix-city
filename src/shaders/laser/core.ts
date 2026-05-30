// Laser beam core — bright red center with energy distortion (GLSL)

export const vertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vY;

  void main() {
    vUv = uv;
    vY = position.y; // local Y is along the beam length

    vec3 pos = position;
    // Slight wave distortion for energy feel
    float wave = sin(pos.y * 4.0 + uTime * 3.0) * 0.015;
    pos.x += wave;
    pos.z += cos(pos.y * 5.0 + uTime * 2.5) * 0.015;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vY;
  uniform float uTime;
  uniform float uLife; // 0..1 life of the laser beam
  uniform vec3 uColor;

  void main() {
    // Radial glow: brighter at center (x=0.5), fading to edges
    float dist = abs(vUv.x - 0.5) * 2.0; // 0 at center, 1 at edge
    float radial = pow(1.0 - dist, 3.0);

    // Pulsing energy along the beam length
    float pulse = sin(vY * 6.0 - uTime * 3.75) * 0.3 + 0.7;

    // Hot white center mixed with red
    vec3 col = mix(uColor, vec3(1.0, 0.85, 0.7), radial * 0.6);
    float alpha = radial * pulse * uLife;

    gl_FragColor = vec4(col, alpha);
  }
`;
