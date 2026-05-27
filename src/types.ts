// Building height record (test.html L344: buildingHeights array)
export interface BuildingHeight {
  x: number;
  z: number;
  h: number;
}

// Vehicle userData shape (test.html L625-L630)
export interface VehicleUserData {
  flyAxis: "x" | "z";
  flySpeed: number;
  flyDir: number;
  flyY: number;
}

// Police drone userData shape (test.html L864-L867)
export interface DroneUserData {
  haloMat?: THREE.ShaderMaterial;
  beamMat?: THREE.ShaderMaterial;
  discMat?: THREE.ShaderMaterial;
  spotLight?: THREE.PointLight;
  curve?: THREE.CatmullRomCurve3;
  t: number;
  speed: number;
  dir: number;
  blinkPhase: number;
}

// Stream sprite userData shape (test.html L1590-L1592)
export interface StreamSpriteData {
  streamSpeed: number;
  streamDir: number;
  streamAxis: "x" | "z";
}

// Antenna blink light userData (test.html L1173-L1174)
export interface BlinkLightData {
  blinkSpeed: number;
  blinkPhase: number;
}

// Laser collision result
export interface CollisionHit {
  point: THREE.Vector3;
  normal?: THREE.Vector3;
}
