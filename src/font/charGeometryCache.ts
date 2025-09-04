import * as THREE from 'three';

/**
 * Manages caching of font character geometries to improve text rendering performance.
 */
export class CharGeometryCache {
  private cache: Map<string, THREE.BufferGeometry>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Returns true if the geometry of the specified character exists in the cache.
   * Otherwise, returns false.
   * @param char One character.
   * @param size The font size.
   * @returns True if the geometry of the specified character exists in the cache.
   * Otherwise, returns false.
   */
  hasGeometry(char: string, size: number) {
    const key = this.generateKey(char, size);
    return this.cache.has(key);
  }

  /**
   * Get the geometry for a single character from cache if available.
   * The cache key includes both character and size.
   * @param char The character to get geometry from cache.
   * @param size The font size.
   * @returns The geometry for a single character from cache if avaiable.
   * Return undefined if the character not found in cache.
   */
  getGeometry(char: string, size: number): THREE.BufferGeometry | undefined {
    const key = this.generateKey(char, size);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    return undefined;
  }

  /**
   * Set the geometry to cache for a single character.
   * @param char The character to set geometry for.
   * @param size The font size.
   * @param geometry The geometry to set.
   */
  setGeometry(char: string, size: number, geometry: THREE.BufferGeometry) {
    const key = this.generateKey(char, size);
    this.cache.set(key, geometry);
  }

  /**
   * Dispose all cached geometries.
   */
  dispose(): void {
    for (const geom of this.cache.values()) {
      geom.dispose();
    }
    this.cache.clear();
  }

  /**
   * Generates cache key by character and font size.
   * @param char One character.
   * @param size The font size.
   */
  private generateKey(char: string, size: number) {
    return `${char}_${size}`;
  }
}
