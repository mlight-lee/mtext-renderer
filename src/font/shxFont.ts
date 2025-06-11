import { Point, ShxFontData, ShxFont as ShxFontInternal, ShxFontType } from '@mlightcad/shx-parser';

import { BaseFont } from './baseFont';
import { ShxTextShape } from './shxTextShape';

/**
 * ShxFont is a class that extends BaseFont and represents a SHX font.
 * It provides methods to generate shapes for text and retrieve character shapes.
 */
export class ShxFont extends BaseFont {
  /** Internal shx font instance */
  private readonly font: ShxFontInternal;
  public readonly type = 'shx';
  public readonly data: ShxFontData;

  constructor(data: ShxFontData | ArrayBuffer) {
    super();
    this.font = new ShxFontInternal(data);
    this.data = this.font.fontData;
  }

  generateShapes(text: string, size: number) {
    const shapes: ShxTextShape[] = [];
    let hOffset = 0.0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === ' ') {
        hOffset += size;
        continue;
      }
      const shape = this.getCharShape(char, size);
      if (!shape) {
        hOffset += size;
        this.addUnsupportedChar(char);
        // const notFund = this.getNotFoundTextShape(size);
        // notFund && shapes.push(notFund);
        continue;
      }
      shapes.push(shape.offset(new Point(hOffset, 0)));
      hOffset += shape.width;
    }
    return shapes;
  }

  /**
   * SHX font always has fixed scale factor 1.
   * @returns Always return value 1
   */
  getScaleFactor() {
    return 1;
  }

  /**
   * Gets the shape data for a specific character at a given size.
   * @param char - The character to get the shape for
   * @param size - The desired size of the character
   * @returns The shape data for the character, or undefined if not found
   */
  public getCharShape(char: string, size: number) {
    let code = this.getCode(char);
    const shape = this.font.getCharShape(code, size);
    return shape ? new ShxTextShape(char, shape) : undefined;
  }

  /**
   * For an unsupported char, use "？" as a replacement.
   */
  public getNotFoundTextShape(size: number) {
    let char = this.font.fontData.header.fontType === ShxFontType.BIGFONT ? '？' : '?';
    return this.getCharShape(char, size);
  }

  private getCode(char: string) {
    const fontType = this.font.fontData.header.fontType;
    if (fontType === ShxFontType.BIGFONT) {
      // TODO: Get code from bigfont
      throw new Error('Bigfont is not supported yet');
    }
    return char.charCodeAt(0);
  }
}
