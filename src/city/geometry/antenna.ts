// Antenna geometry with blinking lights (test.html L1145-L1207)
import * as THREE from "three";
import { BUILDING_WIDTH } from "../../constants.js";
import type { BlinkLightData } from "../../types.js";

/** Add antenna(s) to a building roof. */
export function addAntenna(bx: number, bz: number, maxH: number): THREE.Group {
  const roofY = maxH * 0.32;

  // Random position on roof
  const ax = bx + (Math.random() - 0.5) * BUILDING_WIDTH * 0.6;
  const az = bz + (Math.random() - 0.5) * BUILDING_WIDTH * 0.6;

  const group = new THREE.Group();

  // Pole
  const poleH = 2 + Math.random() * 4;
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.04, poleH, 6);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a1a,
    roughness: 0.6,
    metalness: 0.7,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(ax, roofY + poleH / 2, az);
  group.add(pole);

  // Blinking light at top
  const lightGeo = new THREE.SphereGeometry(0.08, 6, 4);
  const lightMat = new THREE.MeshBasicMaterial({
    color: Math.random() > 0.5 ? 0xff2200 : 0x00ff41,
    transparent: true,
    opacity: 0.9,
  });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(ax, roofY + poleH + 0.08, az);
  (light.userData as BlinkLightData).blinkSpeed = 1 + Math.random() * 3;
  (light.userData as BlinkLightData).blinkPhase = Math.random() * Math.PI * 2;
  group.add(light);

  // Sometimes add a second shorter antenna nearby
  if (Math.random() > 0.5) {
    const ax2 = ax + (Math.random() - 0.5) * 1.5;
    const az2 = az + (Math.random() - 0.5) * 1.5;
    const poleH2 = 1 + Math.random() * 2;
    const pole2Geo = new THREE.CylinderGeometry(0.02, 0.03, poleH2, 6);
    const pole2 = new THREE.Mesh(pole2Geo, poleMat.clone());
    pole2.position.set(ax2, roofY + poleH2 / 2, az2);
    group.add(pole2);

    const light2 = new THREE.Mesh(lightGeo.clone(), lightMat.clone());
    light2.position.set(ax2, roofY + poleH2 + 0.06, az2);
    (light2.userData as BlinkLightData).blinkSpeed = 1 + Math.random() * 3;
    (light2.userData as BlinkLightData).blinkPhase = Math.random() * Math.PI * 2;
    group.add(light2);
  }

  return group;
}

/** Update blink lights on all antenna groups (test.html L2324-L2332). */
export function updateAntennas(groups: THREE.Group[], elapsed: number): void {
  for (const group of groups) {
    for (const child of group.children) {
      const data = child.userData as BlinkLightData;
      if (data.blinkSpeed !== undefined && data.blinkPhase !== undefined) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat.transparent) {
          mat.opacity = 0.9 * (0.5 + 0.5 * Math.sin(elapsed * data.blinkSpeed + data.blinkPhase));
        }
      }
    }
  }
}
