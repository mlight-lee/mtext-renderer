import * as THREE from 'three';

/**
 * Class to manage basic text style
 */
export class StyleManager {
  private lineBasicMaterials: { [color: number]: THREE.Material } = {};
  private meshBasicMaterials: { [color: number]: THREE.Material } = {};
  public unsupportedTextStyles: Record<string, number> = {};

  getMeshBasicMaterial(color: number): THREE.Material {
    if (!this.meshBasicMaterials[color]) {
      this.meshBasicMaterials[color] = new THREE.MeshBasicMaterial({
        color,
      });
    }
    return this.meshBasicMaterials[color];
  }

  getLineBasicMaterial(color: number): THREE.Material {
    if (!this.lineBasicMaterials[color]) {
      this.lineBasicMaterials[color] = new THREE.LineBasicMaterial({
        color,
      });
    }
    return this.lineBasicMaterials[color];
  }
}
