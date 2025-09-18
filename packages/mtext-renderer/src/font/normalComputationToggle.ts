import { BufferGeometry } from 'three'

/**
 * Utility class for temporarily disabling `BufferGeometry.computeVertexNormals`.
 *
 * By default, Three.js computes vertex normals for many geometries,
 * which can be unnecessary (e.g., when using `MeshBasicMaterial` that does not require lighting).
 * This class lets you temporarily replace `computeVertexNormals` with a no-op
 * to save CPU time during geometry creation.
 *
 * Example:
 * ```ts
 * import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
 * import { NormalComputationToggle } from "./NormalComputationToggle";
 *
 * // Create geometry without computing normals
 * const textGeom = NormalComputationToggle.runWithoutNormals(() =>
 *   new TextGeometry("Fast!", { font, size: 1, height: 0.2 })
 * );
 * ```
 */
export class NormalComputationToggle {
  /**
   * Stores the original `computeVertexNormals` method from BufferGeometry.
   */
  private static originalComputeVertexNormals =
    BufferGeometry.prototype.computeVertexNormals

  /**
   * Dummy replacement for `computeVertexNormals` that does nothing.
   */
  private static dummyComputeVertexNormals(): void {
    // Intentionally left blank
  }

  /**
   * Disable vertex normal computation globally.
   *
   * After calling this, all calls to `computeVertexNormals`
   * will do nothing until {@link restore} is called.
   */
  static disable(): void {
    BufferGeometry.prototype.computeVertexNormals =
      this.dummyComputeVertexNormals
  }

  /**
   * Restore the original `computeVertexNormals` implementation.
   */
  static restore(): void {
    BufferGeometry.prototype.computeVertexNormals =
      this.originalComputeVertexNormals
  }

  /**
   * Execute a function with normal computation disabled,
   * then automatically restore afterwards.
   *
   * This is the safest way to create geometries without normals.
   *
   * Example:
   * ```ts
   * const geom = NormalComputationToggle.runWithoutNormals(() =>
   *   new TextGeometry("World", { font, size: 1, height: 0.2 })
   * );
   * ```
   *
   * @param fn - A callback that creates the geometry.
   * @returns The result of the callback, e.g., a geometry.
   */
  static runWithoutNormals<T>(fn: () => T): T {
    this.disable()
    try {
      return fn()
    } finally {
      this.restore()
    }
  }
}
