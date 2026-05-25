// Satellite dish geometry (test.html L1209-L1273)
import * as THREE from "three";
import { BUILDING_WIDTH } from "../../constants.js";

/** Add a satellite dish to a building roof. */
export function addSatelliteDish(bx: number, bz: number, maxH: number): THREE.Group {
  const roofY = maxH * 0.32;

  const dx = bx + (Math.random() - 0.5) * BUILDING_WIDTH * 0.5;
  const dz = bz + (Math.random() - 0.5) * BUILDING_WIDTH * 0.5;

  const group = new THREE.Group();

  // Dish base (cone shape)
  const dishR = 0.3 + Math.random() * 0.25;
  const dishH = dishR * 0.6;
  const dishGeo = new THREE.ConeGeometry(dishR, dishH, 12, 1, true);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a1a,
    roughness: 0.5,
    metalness: 0.8,
    side: THREE.DoubleSide,
  });
  const dish = new THREE.Mesh(dishGeo, dishMat);

  // Tilt the dish upward at a random angle
  const tiltX = (Math.random() - 0.5) * 0.8;
  const tiltZ = (Math.random() - 0.5) * 0.8;
  dish.rotation.set(tiltX, Math.random() * Math.PI * 2, tiltZ);
  dish.position.set(dx, roofY + dishH / 2 - 0.1, dz);
  group.add(dish);

  // Feed horn (small sphere at dish focus)
  const feedGeo = new THREE.SphereGeometry(0.05, 6, 4);
  const feedMat = new THREE.MeshBasicMaterial({
    color: 0x00ff41,
    transparent: true,
    opacity: 0.5,
  });
  const feed = new THREE.Mesh(feedGeo, feedMat);
  // Position at approximate focal point
  const offset = dishR * 0.3;
  feed.position.set(
    dx + Math.sin(tiltX) * offset,
    roofY + dishH - 0.15 + Math.cos(tiltX) * offset * 0.3,
    dz + Math.sin(tiltZ) * offset
  );
  group.add(feed);

  // Support pole
  const poleGeo = new THREE.CylinderGeometry(0.025, 0.03, dishH * 1.2, 6);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x1a2a1a,
    roughness: 0.6,
    metalness: 0.7,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(dx, roofY + dishH * 0.5 - 0.1, dz);
  group.add(pole);

  return group;
}
