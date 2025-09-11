import * as THREE from 'three';
import { MTextData, TextStyle, ColorSettings } from '../renderer/types';

/**
 * Defines the common rendering contract for producing Three.js objects from MText content.
 *
 * Implementations may render on the main thread or delegate work to a Web Worker,
 * but they must expose the same high-level API so callers can switch strategies
 * without changing usage.
 */
export interface MTextBaseRenderer {
  /**
   * Render the provided MText content into a Three.js object hierarchy.
   *
   * The returned root object contains meshes/lines for glyphs and exposes a
   * bounding box on `object.box` if available.
   *
   * @param mtextContent Structured MText input (text, height, width, position).
   * @param textStyle Text style to apply (font, width factor, oblique, etc.).
   * @param colorSettings Optional color context (ByLayer, ByBlock colors).
   * @returns A Promise resolving to a populated `THREE.Object3D` ready to add to a scene.
   */
  renderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings?: ColorSettings
  ): Promise<THREE.Object3D>;

  /**
   * Ensure the specified fonts are available to the renderer.
   *
   * Implementations should load and cache missing fonts; repeated calls should be cheap.
   *
   * @param fonts Font names to load (without extension for built-ins).
   * @returns A Promise with the list of fonts that were processed.
   */
  loadFonts(fonts: string[]): Promise<{ loaded: string[] }>;

  /**
   * Retrieve the list of fonts that can be used by the renderer.
   *
   * The shape of each font entry is implementation-defined but should include a displayable name.
   *
   * @returns A Promise with available font metadata.
   */
  getAvailableFonts(): Promise<{ fonts: Array<{ name: string[] }> }>;

  /**
   * Release any resources owned by the renderer (e.g., terminate Web Workers).
   *
   * Safe to call multiple times.
   */
  destroy(): void;
}
