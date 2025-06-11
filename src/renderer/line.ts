import {
  ChangedProperties,
  MTextParagraphAlignment,
  MTextToken,
  TokenType,
} from '@mlightcad/mtext-parser';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { FontManager } from '../font';
import { StyleManager } from './styleManager';
import { MTextFlowDirection, TextStyle } from './types';
import { getColorByIndex } from '../common';

const tempVector = /*@__PURE__*/ new THREE.Vector3();

// The property palette of mtext can display line spacing. This magic number is inferred from value
// displayed in property palette of mtext.
const LINE_SPACING_SCALE_FACTOR = 1.666666;

export interface TextLineFormatOptions {
  /**
   * Font size.
   */
  fontSize: number;
  /**
   * Scale factor of character width.
   */
  widthFactor: number;
  /**
   * The line space factor.
   */
  lineSpaceFactor: number;
  /**
   * The horizontal alignment.
   */
  horizontalAlignment: MTextParagraphAlignment;
  /**
   * The maximum width of one line of text string.
   */
  maxWidth: number;
  /**
   * The direction that the text string follows from its start to its finish.
   */
  flowDirection: MTextFlowDirection;
  /**
   * The color of the current block which is used when the text color is by block.
   */
  byBlockColor: number;
  /**
   * The color of the current layer which is used when the text color is by layer.
   */
  byLayerColor: number;
}

/**
 * This class represents lines of texts.
 */
export class MTextLines {
  private _style: TextStyle;
  private _styleManager: StyleManager;
  private _fontManager: FontManager;
  private _options: TextLineFormatOptions;
  private _totalHeight: number;
  private _hOffset: number;
  private _vOffset: number;
  private _lineCount: number;
  private _currentLineObjects: THREE.Object3D[];
  private _currentHorizontalAlignment: MTextParagraphAlignment;
  private _currentWidthFactor: number;
  private _currentWordSpace: number;
  private _currentFont!: string;
  private _currentFontScaleFactor!: number;
  private _currentFontSize!: number;
  private _currentFontSizeScaleFactor: number;
  private _currentColor: number;
  private _currentMaxFontSize: number;

  /**
   * Construct one instance of this class and initialize some properties with default values.
   * @param style Input text style
   * @param styleManager Input text style manager instance
   * @param fontManager Input font manager instance
   * @param options Input line formating options
   */
  constructor(
    style: TextStyle,
    styleManager: StyleManager,
    fontManager: FontManager,
    options: TextLineFormatOptions
  ) {
    this._style = style;
    this._styleManager = styleManager;
    this._fontManager = fontManager;
    this._options = options;
    this._totalHeight = 0;
    this._hOffset = 0;
    this._vOffset = 0;
    this._lineCount = 1;
    this._currentLineObjects = [];
    this._currentHorizontalAlignment = options.horizontalAlignment;
    this._currentFont = this.textStyle.font.toLowerCase();
    this._currentWidthFactor = options.widthFactor;
    this._currentWordSpace = 1;
    this._currentColor = options.byLayerColor;
    this._currentFontSizeScaleFactor = 1;
    this._currentMaxFontSize = 0;
    this.initLineParams();
  }

  get fontManager() {
    return this._fontManager;
  }

  get styleManager() {
    return this._styleManager;
  }

  get textStyle() {
    return this._style;
  }

  /**
   * Total height of all lines of text
   */
  get totalHeight() {
    // 'totalHeight' should not include line space after the last line
    if (this._lineCount == 1) {
      return this.currentMaxFontSize;
    } else {
      return this._totalHeight + this.currentLineHeight;
    }
  }

  /**
   * The maximum width of one text line
   */
  get maxWidth() {
    return this._options.maxWidth;
  }

  /**
   * The direction that the text string follows from its start to its finish.
   */
  get flowDirection() {
    return this._options.flowDirection;
  }

  /**
   * The default horizontal alignment of one text line
   */
  get defaultHorizontalAlignment() {
    return this._options.horizontalAlignment;
  }

  /**
   * The default scale factor of character width
   */
  get defaultWidthFactor() {
    return this._options.widthFactor;
  }

  /**
   * The default font size of texts
   */
  get defaultFontSize() {
    return this._options.fontSize;
  }

  /**
   * The default line space factor
   */
  get defaultLineSpaceFactor() {
    return this._options.lineSpaceFactor;
  }

  /**
   * Font name of current character
   */
  get currentFont() {
    return this._currentFont;
  }

  /**
   * The current horizontal alignment of one text line
   */
  get currentHorizontalAlignment() {
    return this._currentHorizontalAlignment;
  }

  /**
   * Scale factor of current font height. The scale factor isn't set by users in text editor.
   * It is one scale factor binded to font. For ttf or woff fonts, it is calculated by certain
   * algorithm. For shx font, it is alway equal to 1.
   */
  get currentFontScaleFactor() {
    return this._currentFontScaleFactor;
  }

  /**
   * Font size of current character
   */
  get currentFontSize() {
    return this._currentFontSize;
  }

  /**
   * Font size scale factor of current character
   */
  get currentFontSizeScaleFactor() {
    return this._currentFontSizeScaleFactor;
  }

  /**
   * The height of current line of texts
   */
  get currentLineHeight() {
    const lineSpace =
      this.defaultLineSpaceFactor * this._currentFontSize * LINE_SPACING_SCALE_FACTOR;
    return lineSpace + this.currentMaxFontSize;
  }

  /**
   * The maximum font size in current line. Characters in one line may have different font and font
   * size. So we need to store the maximum font size in current line in order to calculate the height
   * of current line.
   */
  get currentMaxFontSize() {
    return this._currentMaxFontSize;
  }

  /**
   * The current space setting between two characters
   */
  get currentWordSpace() {
    return this._currentWordSpace;
  }

  /**
   * The current scale factor of character width
   */
  get currentWidthFactor() {
    return this._currentWidthFactor;
  }

  /**
   * The current text color
   */
  get currentColor() {
    return this._currentColor;
  }

  /**
   * All of THREE.js objects in current line. It contains objects in all of sections of this line.
   */
  get currentLineObjects() {
    return this._currentLineObjects;
  }

  /**
   * The horizental offset of current character in this line
   */
  get hOffset() {
    return this._hOffset;
  }
  set hOffset(value: number) {
    this._hOffset = value;
  }

  /**
   * The vertical offset of current character in this line
   */
  get vOffset() {
    return this._vOffset;
  }
  set vOffset(value: number) {
    this._vOffset = value;
  }

  /**
   * Process text format information
   * @param item Input mtext inline codes
   */
  processFormat(item: ChangedProperties) {
    switch (item.command) {
      case 'f':
      case 'F':
        if (item.changes.fontFace) {
          this.changeFont(item.changes.fontFace.family);
          if (this.currentFont && this.currentFont.includes('.shx')) {
            console.log(`Doesn't support custom fonts: ${this.currentFont}`);
          }
          break;
        }
      case 'C':
        if (item.changes.aci) {
          if (item.changes.aci === 0) {
            this._currentColor = this._options.byBlockColor;
          } else if (item.changes.aci === 256) {
            this._currentColor = this._options.byLayerColor;
          } else {
            this._currentColor = getColorByIndex(item.changes.aci);
          }
        } else if (item.changes.rgb) {
          this._currentColor =
            (item.changes.rgb[0] << 16) + (item.changes.rgb[1] << 8) + item.changes.rgb[2];
        }
        break;
      case 'W':
        if (item.changes.widthFactor) {
          if (item.changes.widthFactor.isRelative) {
            this._currentWidthFactor = item.changes.widthFactor.value * this.maxWidth;
          } else {
            this._currentWidthFactor = item.changes.widthFactor.value * 0.93;
          }
        }
        break;
      case 'H':
        if (item.changes.capHeight) {
          if (item.changes.capHeight.isRelative) {
            this.changeFontSizeScaleFactor(item.changes.capHeight.value);
          } else {
            this.changeFontHeight(item.changes.capHeight.value);
          }
        }
        break;
      case 'T':
        if (item.changes.charTrackingFactor) {
          if (item.changes.charTrackingFactor.isRelative) {
            // TODO: Handle relative value
            this._currentWordSpace = item.changes.charTrackingFactor.value;
          } else {
            this._currentWordSpace = item.changes.charTrackingFactor.value;
          }
        }
        break;
      case 'q':
        if (item.changes.paragraph && item.changes.paragraph.align) {
          this._currentHorizontalAlignment = item.changes.paragraph.align;
        }
        break;
      default:
        // TODO: handle psm, underscore, overscore, strike, and etc.
        break;
    }
  }

  /**
   * Render the specified texts
   * @param item Input texts to render
   */
  processText(tokens: Generator<MTextToken>) {
    const geometries: THREE.BufferGeometry[] = [];
    const group: THREE.Group = new THREE.Group();

    for (const token of tokens) {
      if (token.type === TokenType.NEW_PARAGRAPH) {
        this.startNewLine();
        this.processGeometries(geometries, group);
      } else if (token.type === TokenType.WORD) {
        const words = token.data;
        if (Array.isArray(words)) {
          words.forEach((word) => this.processWord(word, geometries));
        } else if (typeof words === 'string' && words.length > 0) {
          this.processWord(words, geometries);
        }
        this.processGeometries(geometries, group);
      } else if (token.type === TokenType.SPACE) {
        this.processBlank();
      } else if (token.type === TokenType.PROPERTIES_CHANGED) {
        this.processFormat(token.data as ChangedProperties);
        this.processGeometries(geometries, group);
      }
    }

    if (geometries.length > 0) {
      this.processGeometries(geometries, group);
    }
    return group;
  }

  private processGeometries(geometries: THREE.BufferGeometry[], group: THREE.Group) {
    if (geometries.length > 0) {
      const object = this.toThreeObject(geometries);
      group.add(object);
      geometries.length = 0;
    }
  }

  private processWord(word: string, geometries: THREE.BufferGeometry[]) {
    for (let i = 0; i < word.length; i++) {
      this.processChar(word[i], geometries);
    }
  }

  private processBlank() {
    this._hOffset += this.currentFontSize * this.currentWordSpace * this.currentWidthFactor;
  }

  private processChar(char: string, geometries: THREE.BufferGeometry[]): void {
    const shape = this.getCharShape(char);
    if (!shape) {
      this.processBlank();
      return;
    }

    const geometry = shape.toGeometry();
    geometry.scale(this.currentWidthFactor, 1, 1);

    if (this.hOffset > (this.maxWidth || Infinity)) {
      this.startNewLine();
    }

    if (this.flowDirection == MTextFlowDirection.BOTTOM_TO_TOP) {
      geometry.translate(this.hOffset, this.vOffset, 0);
    } else {
      // The origin of font shape geometry is left-bottom cornor point instead of left-top cornor point.
      // So we need to substract the height of texts so that texts are shown like its origin point is
      // left-top point if the flow direction of text is from top to bottom.
      geometry.translate(this.hOffset, this.vOffset - this.currentFontSize, 0);
    }

    // If the horizontal alignment is distributed, just ignore wordspace.
    // Wordspace will be calcualted in method 'processAlignment'.
    if (this.currentHorizontalAlignment == MTextParagraphAlignment.DISTRIBUTED) {
      this._hOffset += shape.width * this.currentWidthFactor;
    } else {
      this._hOffset += shape.width * this.currentWordSpace * this.currentWidthFactor;
    }
    geometries.push(geometry);
  }

  processLastLine() {
    this.processAlignment();
  }

  private initLineParams() {
    this.calcuateLineParams();
  }

  private changeFontHeight(newFontHeight: number) {
    this.calcuateLineParams(newFontHeight);
  }

  private changeFont(fontName: string) {
    this._currentFont = this.fontManager.findAndReplaceFont(fontName);
    this.calcuateLineParams();
  }

  private changeFontSizeScaleFactor(factor: number) {
    this._currentFontSizeScaleFactor *= factor;
    this.calcuateLineParams();
  }

  /**
   * Calcuate font size, line space, line height and other parameters.
   */
  private calcuateLineParams(newFontHeight?: number) {
    this._currentFontScaleFactor = this.fontManager.getFontScaleFactor(this.currentFont);

    const fontHeight = newFontHeight || this.defaultFontSize || this.textStyle.fixedTextHeight;
    this._currentFontSize =
      fontHeight * this.currentFontScaleFactor * this.currentFontSizeScaleFactor;
  }

  /**
   * Get text shape of the specified character
   * @param char Input one character
   * @returns Return the text shape of the specified character
   */
  private getCharShape(char: string) {
    let shape = this.fontManager.getCharShape(char, this.currentFont, this.currentFontSize);
    if (this.textStyle.bigFont && !shape) {
      shape = this.fontManager.getCharShape(char, this.textStyle.bigFont, this.currentFontSize);
    }
    if (!shape) {
      // When the text cannot be found in the font file, all font files are searched until the text is found.
      shape = this.fontManager.getCharShape(char, '', this.currentFontSize);
    }
    if (!shape) {
      shape = this.fontManager.getNotFoundTextShape(this.currentFontSize);
    }

    // Store the maximum font size in current line
    if (this.currentFontSize > this.currentMaxFontSize) {
      this._currentMaxFontSize = this.currentFontSize;
    }
    return shape;
  }

  private startNewLine() {
    this._hOffset = 0;
    if (this.flowDirection == MTextFlowDirection.BOTTOM_TO_TOP) {
      this._vOffset += this.currentLineHeight;
    } else {
      this._vOffset -= this.currentLineHeight;
    }

    this._lineCount++;

    this.processAlignment();
    this._currentLineObjects = [];

    if (this._lineCount == 2) {
      this._totalHeight = this.currentMaxFontSize;
    } else {
      this._totalHeight = this._totalHeight + this.currentLineHeight;
    }
  }

  /**
   * Apply translation on the specified buffer geometries according to text alignment setting
   */
  private processAlignment() {
    const geometries: THREE.BufferGeometry[] = [];
    this.currentLineObjects.forEach((object) =>
      object.traverse((obj) => {
        if ('geometry' in obj) {
          geometries.push(obj.geometry as THREE.BufferGeometry);
        }
      })
    );
    if (geometries.length == 0) return;

    let bbox: THREE.Box3 | undefined;
    geometries.forEach((g, i) => {
      if (!g.boundingBox) {
        g.computeBoundingBox();
      }
      if (i === 0) {
        bbox = g.boundingBox as THREE.Box3;
      } else {
        bbox!.union(g.boundingBox as THREE.Box3);
      }
    });
    if (bbox) {
      const size = bbox.getSize(tempVector);
      switch (this.currentHorizontalAlignment) {
        case MTextParagraphAlignment.LEFT:
          break;
        case MTextParagraphAlignment.CENTER:
          geometries.forEach((g) => g.translate((this.maxWidth - size.x) / 2, 0, 0));
          break;
        case MTextParagraphAlignment.RIGHT:
          geometries.forEach((g) => g.translate(this.maxWidth - size.x, 0, 0));
          break;
        case MTextParagraphAlignment.DISTRIBUTED:
          if (geometries.length > 1) {
            const gap = (this.maxWidth - size.x) / (geometries.length - 1);
            for (let k = 1; k < geometries.length; k++) {
              const geometry = geometries[k];
              geometry.translate(gap * k, 0, 0);
            }
          }
          break;
        default:
          break;
      }
    }
  }

  /**
   * Convert the text shape geometries to three.js object
   * @param geometries Input text shape geometries
   * @returns Return three.js object created from the specified text shape geometries
   */
  private toThreeObject(geometries: THREE.BufferGeometry[]) {
    const meshGroup = new THREE.Group();
    if (geometries.length > 0) {
      const color = this.currentColor;
      const meshGeoms = geometries.filter((g) => g instanceof THREE.ExtrudeGeometry);
      const lineGeoms = geometries.filter((g) => !(g instanceof THREE.ExtrudeGeometry));
      // Sometimes linear text may not be supported, so it is possible to create a mesh text
      if (meshGeoms.length > 0) {
        const mesh = new THREE.Mesh();
        mesh.geometry = mergeGeometries(meshGeoms);
        mesh.material = this.styleManager.getMeshBasicMaterial(color);
        // Add the flag to check intersection using bounding box of the mesh
        mesh.userData.bboxIntersectionCheck = true;
        meshGroup.add(mesh);
      }
      if (lineGeoms.length > 0) {
        const mesh = new THREE.LineSegments();
        mesh.geometry = mergeGeometries(lineGeoms);
        mesh.material = this.styleManager.getLineBasicMaterial(color);
        // Add the flag to check intersection using bounding box of the mesh
        mesh.userData.bboxIntersectionCheck = true;
        meshGroup.add(mesh);
      }
    }
    // reduce hierarchy
    if (meshGroup.children.length === 1) {
      return meshGroup.children[0];
    } else {
      return meshGroup;
    }
  }
}
