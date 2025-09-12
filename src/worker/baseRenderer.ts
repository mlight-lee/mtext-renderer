import * as THREE from 'three';
import { MTextData, TextStyle, ColorSettings } from '../renderer/types';

/**
 * Represents a rendered MText object that extends THREE.Object3D with additional MText-specific properties.
 * This interface defines the contract for objects returned by MText renderers.
 */
export interface MTextObject extends THREE.Object3D {
  /**
   * The bounding box of the MText object in local coordinates.
   * This box represents the bounds of the text content without considering transformations.
   * To get the world-space bounding box, apply the object's world matrix to this box.
   */
  box: THREE.Box3;
}

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
   * bounding box on `object.box`.
   *
   * @param mtextContent Structured MText input (text, height, width, position).
   * @param textStyle Text style to apply (font, width factor, oblique, etc.).
   * @param colorSettings Optional color context (ByLayer, ByBlock colors).
   * @returns A Promise resolving to a populated `MTextObject` ready to add to a scene.
   */
  renderMText(
    mtextContent: MTextData,
    textStyle: TextStyle,
    colorSettings?: ColorSettings
  ): Promise<MTextObject>;

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
