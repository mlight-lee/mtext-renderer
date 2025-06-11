import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

import { BaseTextShape } from './baseTextShape';
import { MeshFont } from './meshFont';

/**
 * Represents a text shape for mesh-based fonts (e.g., TTF, OTF, WOFF).
 * This class extends BaseTextShape to provide specific functionality for mesh fonts,
 * including 3D geometry generation and character width calculation.
 */
export class MeshTextShape extends BaseTextShape {
  /**
   * Flag to indicate whether the character is found in the font.
   * Used to track if the character exists in the font's glyph set.
   */
  public isFound = false;

  private readonly font: MeshFont;
  private readonly fontSize: number;

  constructor(char: string, fontSize: number, font: MeshFont) {
    super(char);
    this.fontSize = fontSize;
    this.font = font;
    this.width = this.getCharWidth(char, fontSize, font);
  }

  /**
   * Converts the text shape to a THREE.js geometry.
   * This is used for 3D rendering of the text.
   * @returns A THREE.js BufferGeometry representing the text shape
   */
  toGeometry(): THREE.BufferGeometry {
    return new TextGeometry(this.char, {
      font: this.font.font,
      depth: 0,
      size: this.fontSize,
      curveSegments: 3, // change this to increase/decrease display precision
      bevelSegments: 3,
    });
  }

  /**
   * Calculates the width of a character in the font.
   * @param char - The character to calculate width for
   * @param fontSize - The size of the font in pixels
   * @param font - The mesh font to use
   * @returns The width of the character in pixels
   */
  private getCharWidth(char: string, fontSize: number, font: MeshFont) {
    const glyph = font.data.glyphs[char];
    if (!glyph) {
      this.isFound = false;
      return 0;
    }
    this.isFound = true;
    return (glyph.ha * fontSize) / font.data.resolution;
  }
}
