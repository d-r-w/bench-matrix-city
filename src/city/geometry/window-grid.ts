// Window grid instanced mesh (test.html L938-L1046)
import * as THREE from "three";
import { BUILDING_WIDTH } from "../../constants.js";
import { fragmentShader, vertexShader } from "../../shaders/window-grid.js";

/** Create an instanced mesh of flickering windows on all four faces of a building. */
export function addWindowGrid(bx: number, bz: number, maxH: number): THREE.InstancedMesh | null {
  const hw = BUILDING_WIDTH / 2;
  const buildingH = maxH * 0.32;
  const winW = 0.45;
  const winH = 0.35;
  const gapX = 1.0;
  const gapY = 0.95;

  // Collect window positions per face for instancing
  const winPositions: number[] = [];
  const winBrights: number[] = [];
  const winFaceRotations: number[] = []; // Y rotation per window so each faces outward

  const faceDefs = [
    { axis: "x" as const, sign: 1, rotY: 0 },
    { axis: "x" as const, sign: -1, rotY: Math.PI },
    { axis: "z" as const, sign: 1, rotY: Math.PI / 2 },
    { axis: "z" as const, sign: -1, rotY: -Math.PI / 2 },
  ];

  for (const face of faceDefs) {
    const cols = Math.floor((BUILDING_WIDTH - 0.6) / gapX);
    const rows = Math.floor((buildingH - 1.0) / gapY);

    for (let c = 0; c < cols; c++) {
      const localX = (c - cols / 2 + 0.5) * gapX;
      for (let r = 0; r < rows; r++) {
        const localY = 0.6 + r * gapY;

        // Randomly skip windows for organic look — ~85% dark
        if (Math.random() > 0.15) continue;

        let px: number;
        let pz: number;
        if (face.axis === "x") {
          px = bx + localX;
          pz = bz + face.sign * (hw + 0.01);
        } else {
          px = bx + face.sign * (hw + 0.01);
          pz = bz + localX;
        }

        winPositions.push(px, localY, pz);
        // Brightness: some windows are warm amber, most green
        const isWarm = Math.random() > 0.85;
        winBrights.push(isWarm ? 2.0 : 1.0);
        winFaceRotations.push(face.rotY);
      }
    }
  }

  if (winPositions.length === 0) return null;

  const count = winPositions.length / 3;
  const geo = new THREE.PlaneGeometry(winW, winH);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(winPositions[i * 3], winPositions[i * 3 + 1], winPositions[i * 3 + 2]);
    dummy.rotation.set(0, winFaceRotations[i], 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.geometry.setAttribute(
    "instanceBright",
    new THREE.InstancedBufferAttribute(new Float32Array(winBrights), 1)
  );
  mesh.geometry.setAttribute(
    "instancePhase",
    new THREE.InstancedBufferAttribute(
      new Float32Array(count).map(() => Math.random() * Math.PI * 2),
      1
    )
  );
  mesh.geometry.setAttribute(
    "instanceFreq",
    new THREE.InstancedBufferAttribute(
      new Float32Array(count).map(() => 0.5 + Math.random() * 4.0),
      1
    )
  );

  return mesh;
}

/** Update time uniform on all window meshes (test.html L2317-L2322). */
export function updateWindowMeshes(meshes: THREE.InstancedMesh[], elapsed: number): void {
  for (const wm of meshes) {
    const mat = wm.material as THREE.ShaderMaterial;
    if (mat.uniforms) {
      mat.uniforms.uTime.value = elapsed;
    }
  }
}
