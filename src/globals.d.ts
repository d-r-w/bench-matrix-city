/// <reference types="bun" />

declare global {
  interface Window {
    _camLight?: THREE.PointLight;
    _matrixInstancedMesh?: THREE.InstancedMesh;
    _windowMeshes?: THREE.InstancedMesh[];
    _antennaGroups?: THREE.Group[];
    _vehicles?: THREE.Object3D[];
    _policeDrones?: THREE.Group[];
    _groundPlane?: THREE.Mesh;
    _streamSprites?: THREE.Sprite[];
    _rain?: THREE.Points;
    _hazeLayers?: THREE.Mesh[];
    _lightBeams?: THREE.Group[];
    _buildingHeights?: Array<{ x: number; z: number; h: number }>;
  }
}

export {};
