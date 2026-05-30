// Police drone — body, halo ring, searchlight beam, ground disc (test.html L651-L870)
import * as THREE from "three";
import {
  fragmentShader as groundDiscFragment,
  vertexShader as groundDiscVertex,
} from "../shaders/police-drone/ground-disc.js";
import {
  fragmentShader as haloRingFragment,
  vertexShader as haloRingVertex,
} from "../shaders/police-drone/halo-ring.js";
import {
  fragmentShader as searchlightFragment,
  vertexShader as searchlightVertex,
} from "../shaders/police-drone/searchlight.js";
import type { DroneUserData } from "../types.js";

/** Create a single police drone group. */
export function createPoliceDrone(): THREE.Group {
  const group = new THREE.Group();

  // Dark body — flat hexagonal disc
  const bodyGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2a,
    emissive: 0x58796e,
    emissiveIntensity: 0.8,
    roughness: 0.4,
    metalness: 1,
  });
  group.add(new THREE.Mesh(bodyGeo, bodyMat));

  // Central dome (radome)
  const domeGeo = new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.MeshBasicMaterial({
    color: 0x334455,
    transparent: true,
    opacity: 0.6,
  });
  group.add(new THREE.Mesh(domeGeo, domeMat));

  // Rotating/pulsing red-blue halo ring
  const haloGeo = new THREE.TorusGeometry(0.38, 0.04, 8, 48);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: haloRingVertex,
    fragmentShader: haloRingFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  group.add(halo);

  // Searchlight cone underneath (volumetric scanner beam)
  const beamGeo = new THREE.CylinderGeometry(0.02, 1.8, 10, 8, 1, true);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProximity: { value: 0.0 },
    },
    vertexShader: searchlightVertex,
    fragmentShader: searchlightFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -5;
  beam.visible = false; // hidden until drone takes off
  group.add(beam);

  // Ground-level scan disc — where the spotlight hits the ground
  const discGeo = new THREE.RingGeometry(0.1, 2.5, 32);
  const discMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uProximity: { value: 0.0 },
    },
    vertexShader: groundDiscVertex,
    fragmentShader: groundDiscFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -10;
  disc.visible = false; // hidden until drone takes off
  group.add(disc);

  // Green point light for local illumination (off until drone takes off)
  const spotLight = new THREE.PointLight(0x00ff44, 0.5, 15);
  spotLight.position.y = -3;
  spotLight.visible = false;
  group.add(spotLight);

  // Store references for animation
  const ud = group.userData as DroneUserData;
  ud.haloMat = haloMat;
  ud.beamMat = beamMat;
  ud.discMat = discMat;
  ud.spotLight = spotLight;

  return group;
}
