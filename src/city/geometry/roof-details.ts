// Roof details: AC units, water towers (test.html L1275-L1330)
import * as THREE from "three";
import { BUILDING_WIDTH } from "../../constants.js";

/** Add miscellaneous roof details to a building. */
export function addRoofDetails(bx: number, bz: number, maxH: number): THREE.Group {
  const group = new THREE.Group();

  // AC unit / box on roof
  if (Math.random() > 0.4) {
    const acW = 0.6 + Math.random() * 0.5;
    const acD = 0.4 + Math.random() * 0.3;
    const acH = 0.5 + Math.random() * 0.4;
    const roofY = maxH * 0.32;
    const acGeo = new THREE.BoxGeometry(acW, acH, acD);
    const acMat = new THREE.MeshStandardMaterial({
      color: 0x0a150a,
      roughness: 0.7,
      metalness: 0.5,
    });
    const ac = new THREE.Mesh(acGeo, acMat);
    ac.position.set(
      bx + (Math.random() - 0.5) * BUILDING_WIDTH * 0.4,
      roofY + acH / 2,
      bz + (Math.random() - 0.5) * BUILDING_WIDTH * 0.4
    );
    group.add(ac);
  }

  // Water tower on some taller buildings
  if (maxH > 20 && Math.random() > 0.7) {
    const roofY = maxH * 0.32;
    const towerX = bx + (Math.random() - 0.5) * BUILDING_WIDTH * 0.3;
    const towerZ = bz + (Math.random() - 0.5) * BUILDING_WIDTH * 0.3;

    // Legs
    const legH = 2 + Math.random();
    for (const [lx, lz] of [
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3],
    ]) {
      const legGeo = new THREE.CylinderGeometry(0.02, 0.03, legH, 4);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1a2a1a, metalness: 0.7 });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(towerX + lx, roofY + legH / 2, towerZ + lz);
      group.add(leg);
    }

    // Tank
    const tankGeo = new THREE.CylinderGeometry(0.5, 0.6, 1.2, 8);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x0a150a,
      roughness: 0.6,
      metalness: 0.5,
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(towerX, roofY + legH + 0.6, towerZ);
    group.add(tank);
  }

  return group;
}
