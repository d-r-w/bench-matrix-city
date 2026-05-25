// Building box geometry with ledges, cornice, and pipes (test.html L925-L1003)
import * as THREE from "three";
import { BUILDING_WIDTH } from "../../constants.js";

/** Create the main building body group with architectural details. */
export function createBuildingBox(bx: number, bz: number, maxH: number): THREE.Group {
  const hw = BUILDING_WIDTH / 2;
  const h = maxH * 0.32;

  // Main box + horizontal ledges at intervals for architectural detail
  const group = new THREE.Group();

  // Main building body (slightly inset from full width to leave room for ledges)
  const bodyW = BUILDING_WIDTH - 0.1;
  const bodyGeo = new THREE.BoxGeometry(bodyW, h, bodyW);
  group.add(new THREE.Mesh(bodyGeo));

  // Horizontal ledges every few floors — positioned in local coords (-h/2 to +h/2)
  const ledgeCount = Math.max(1, Math.floor(maxH / 6));
  for (let l = 0; l < ledgeCount; l++) {
    // Distribute evenly within building bounds, inset from top/bottom edges
    const ledgeY = ((l + 1) / (ledgeCount + 1)) * h - h / 2;
    const ledgeW = BUILDING_WIDTH + 0.2;
    const ledgeGeo = new THREE.BoxGeometry(ledgeW, 0.08, ledgeW);
    const ledge = new THREE.Mesh(ledgeGeo);
    ledge.position.y = ledgeY;
    group.add(ledge);
  }

  // Top cornice (wider ledge at roof) — top edge flush with building top
  const corniceW = BUILDING_WIDTH + 0.3;
  const corniceGeo = new THREE.BoxGeometry(corniceW, 0.12, corniceW);
  const cornice = new THREE.Mesh(corniceGeo);
  cornice.position.y = h / 2 - 0.06; // center so top edge sits at +h/2
  group.add(cornice);

  // Vertical pipes/conduits on random edges
  const pipeCount = Math.floor(Math.random() * 3);
  for (let p = 0; p < pipeCount; p++) {
    const faceIdx = Math.floor(Math.random() * 4);
    const pipeGeo = new THREE.CylinderGeometry(0.04, 0.05, h * (0.6 + Math.random() * 0.4), 6);
    const pipe = new THREE.Mesh(pipeGeo);

    // Position along building edge
    const edgePos = (Math.random() - 0.5) * BUILDING_WIDTH * 0.7;
    const offset = hw + 0.06;

    if (faceIdx === 0) {
      pipe.position.set(edgePos, h * 0.1, offset);
    } else if (faceIdx === 1) {
      pipe.position.set(edgePos, h * 0.1, -offset);
    } else if (faceIdx === 2) {
      pipe.position.set(offset, h * 0.1, edgePos);
    } else {
      pipe.position.set(-offset, h * 0.1, edgePos);
    }

    group.add(pipe);
  }

  group.position.set(bx, h / 2, bz);
  return group;
}
