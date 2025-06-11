import { Font, FontData } from 'three/examples/jsm/loaders/FontLoader.js';

import { BaseFont } from './baseFont';
import { MeshTextShape } from './meshTextShape';
import { parseMeshFont } from './meshFontParser';

export interface MeshFontData extends FontData {
  scaleFactor: number;
}

export class MeshFont extends BaseFont {
  protected scaleFactor?: number;
  /**
   * Three.js font
   */
  public readonly font: Font;
  public readonly type = 'mesh';
  public readonly data: MeshFontData;

  /**
   * Creates a new instance of MeshFont.
   * @param data - Either a MeshFontData object containing font information or an ArrayBuffer containing raw font data
   */
  constructor(data: MeshFontData | ArrayBuffer) {
    super();
    if (data instanceof ArrayBuffer) {
      this.data = parseMeshFont(data);
    } else {
      this.data = data;
    }
    this.font = new Font(this.data);
  }

  generateShapes(text: string, size: number) {
    return this.font.generateShapes(text, size);
  }

  getCharShape(char: string, size: number) {
    const glyph = this.data.glyphs[char];
    if (!glyph) {
      this.addUnsupportedChar(char);
      return undefined;
    }

    const textShape = new MeshTextShape(char, size, this);
    return textShape;
  }

  getScaleFactor() {
    if (this.scaleFactor == null) {
      this.scaleFactor = this.data.scaleFactor as number;
      return this.scaleFactor;
    }
    return this.scaleFactor;
  }

  /**
   * For an unsupported char, use "？" as a replacement.
   */
  getNotFoundTextShape(size: number) {
    return new MeshTextShape('?', size, this);
  }
}
