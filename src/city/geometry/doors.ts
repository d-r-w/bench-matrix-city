// Door geometry with emissive frame (test.html L1080-L1143)
import * as THREE from "three";
import { BUILDING_WIDTH } from "../../constants.js";

/** Add door(s) to one or two random faces of a building. */
export function addDoors(bx: number, bz: number): THREE.Group {
  const hw = BUILDING_WIDTH / 2;
  const doorW = 0.8;
  const doorH = 1.4;

  // Pick one or two random faces for doors
  const faceCount = Math.random() > 0.5 ? 1 : 2;
  const faces = [
    { axis: "x" as const, sign: 1, rotY: 0 },
    { axis: "z" as const, sign: 1, rotY: Math.PI / 2 },
  ];

  const group = new THREE.Group();

  for (let f = 0; f < faceCount; f++) {
    const face = faces[f % faces.length];
    let px: number;
    let pz: number;
    if (face.axis === "x") {
      px = bx + (Math.random() - 0.5) * BUILDING_WIDTH * 0.6;
      pz = bz + face.sign * (hw + 0.02);
    } else {
      px = bx + face.sign * (hw + 0.02);
      pz = bz + (Math.random() - 0.5) * BUILDING_WIDTH * 0.6;
    }

    // Door frame (emissive border)
    const frameGeo = new THREE.PlaneGeometry(doorW + 0.15, doorH + 0.1);
    const frameMat = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.set(px, doorH / 2, pz);
    frame.rotation.y = face.rotY;

    // Inner dark panel
    const innerGeo = new THREE.PlaneGeometry(doorW - 0.1, doorH - 0.1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x001a05,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.set(px, doorH / 2, pz + face.sign * -0.005);
    inner.rotation.y = face.rotY;

    group.add(frame);
    group.add(inner);
  }

  return group;
}
